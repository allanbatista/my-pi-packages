# Pi Runtime Adaptation

Referência normativa da interface real de `@tintinweb/pi-subagents` (v0.14.x). É a fonte da sintaxe de delegação para todos os managers (`batista-loop`, `batista-manifest`, `batista-execute`). O que não estiver aqui deve ser confirmado no README da extensão instalada (`~/.pi/agent/npm/node_modules/@tintinweb/pi-subagents/README.md`).

## Fronteira correta

- `/skill:<name>` é entry point de **input do usuário**. Texto emitido pelo assistant não invoca outra skill.
- `/agents` é o **menu humano** da extensão (gerenciar agents, settings, scheduled jobs, FleetView). Managers nunca o invocam.
- Managers executam delegações pela ferramenta `Agent` (registrada pela extensão); nunca escrevem slash commands esperando que o Pi os execute.
- `pi install npm:@tintinweb/pi-subagents` instala a extensão; sem ela não existem as tools `Agent`/`get_subagent_result`/`steer_subagent` — nesse caso os managers gravam `Status: blocked` e instruem a instalação. Nunca simular guardian/worker/validador inline e nunca marcar `ready`/`done` sem children reais.

## O que a extensão oferece (v0.14.x)

**Tools LLM-callable (é com elas que os managers operam):**

| Tool | Parâmetros | Uso no workflow |
|---|---|---|
| `Agent` | `prompt`, `description`, `subagent_type` (obrigatórios); `model`, `thinking`, `max_turns`, `run_in_background`, `resume`, `isolated`, `isolation: "worktree"`, `inherit_context`, `schedule` (opcionais) | dispatch de workers, validators, guardians e autores |
| `get_subagent_result` | `agent_id`, `wait`, `verbose` | recuperar resultado de background; `wait: true` bloqueia até completar |
| `steer_subagent` | `agent_id`, `message` | redirecionar um child em execução (interrompe após a tool atual) |

**Comando:** `/agents` — menu interativo: agentes em execução, agent types (listagem com fonte `•` projeto / `◦` global / `✕` desabilitado), criar/editar/ejetar/desabilitar agents, settings (max concurrency, max turns, grace turns, join mode, scheduling, scope models, output transcript, tool description, widget, fleet view).

**Agent types default:** `general-purpose` (herda o prompt do pai — "parent twin"), `Explore` e `Plan` (read-only: `read, bash, grep, find, ls`). Tipos desconhecidos caem em `general-purpose`.

**Custom agents (é onde vivem os papéis do workflow):** arquivos `.md` com frontmatter YAML; o nome do arquivo vira o `subagent_type`. Descoberta por prioridade:

| Prioridade | Local | Escopo |
|---|---|---|
| 1 | `.pi/agents/<name>.md` | projeto — autoridade (é onde `/agents` escreve) |
| 2 | `.agents/agents/<name>.md` | projeto — workspace compartilhado cross-tool |
| 3 | `~/.pi/agent/agents/<name>.md` (`$PI_CODING_AGENT_DIR/agents`) | global |

Campos de frontmatter suportados (todos opcionais): `name`, `description`, `display_name`, `tools` (builtins `read, bash, edit, write, grep, find, ls`, `*`/`all`, `none`, `ext:<ext>/<tool>`), `extensions` (true/false/lista), `exclude_extensions`, `skills` (true/lista/false), `memory` (project/local/user), `disallowed_tools`, `isolation: worktree`, `model` (provider/id ou fuzzy), `thinking` (off|minimal|low|medium|high|xhigh|max), `max_turns`, `persist_session`, `output_transcript`, `session_dir`, `prompt_mode` (`replace` = corpo é o system prompt, sem herança de AGENTS.md/CLAUDE.md; `append` = twin do pai), `inherit_context`, `run_in_background`, `isolated`, `enabled`. **Frontmatter é autoritativo**: `model`/`thinking`/`max_turns`/`inherit_context` pinados no arquivo não são sobrescritos por parâmetros da chamada. Campos desconhecidos são ignorados.

**Settings persistidos** (não é o settings.json do Pi): `~/.pi/agent/subagents.json` (global, manual) + `<cwd>/.pi/subagents.json` (projeto, escrito por `/agents`; projeto vence). Campos: `maxConcurrent` (default 4), `defaultMaxTurns`, `graceTurns` (5), `defaultJoinMode` (smart|async|group), `schedulingEnabled`, `scopeModels`, `disableDefaultAgents`, `outputTranscript`, `toolDescriptionMode` (full|compact|custom), `widgetMode` (all|background|off). Ver `examples/subagents.json`.

**Outras capacidades:** worktree isolation (`isolation: "worktree"` — cópia isolada do repo, commit automático em branch `pi-agent-<id>` ou cleanup); schedule (cron/intervalo/one-shot — **fora do workflow**: managers não agendam); persistência de sessão (`resume`); steering; graceful max turns; memory persistente por agente; skill preloading; transcripts `.output`; eventos `pi.events` (`subagents:created|started|completed|failed|steered|compacted|ready|...`); RPC cross-extension via `subagents:rpc:ping|spawn|stop` (envelope `{success, data|error}`; `options.cwd` só existe nesse caminho RPC).

## Papéis do workflow → agent types

Os papéis são custom agents definidos neste package (`agents/`) e instalados em `~/.pi/agent/agents/` (global) ou `.pi/agents/` (projeto):

| Papel | subagent_type | Tools | Modelo/thinking |
|---|---|---|---|
| Autor de artefato | `delegate` | read, bash, edit, write, grep, find, ls | herda a sessão |
| Implementação | `worker` | read, bash, edit, write, grep, find, ls | `deepseek/deepseek-v4-flash` + `thinking: off` (frontmatter) |
| Validação de execução | `workflow-validator` | read, grep, find, ls | `deepseek/deepseek-v4-flash` + `thinking: xhigh` (frontmatter) |
| Guardian de artefato/outcome | `artifact-guardian` | read, grep, find, ls | herda a sessão |

## Preflight (substitui o antigo `action: list`/`get`)

A v0.14.x **não** expõe RPC `action: list`/`get` pela tool `Agent`. O preflight real é:

1. **Extensão ativa:** as tools `Agent`, `get_subagent_result` e `steer_subagent` existem no harness (presença na lista de tools).
2. **Papéis presentes:** para cada papel usado, existe o arquivo do agente em `~/.pi/agent/agents/` (ou `.pi/agents/` do projeto) — `delegate.md`, `worker.md`, `workflow-validator.md`, `artifact-guardian.md` — com frontmatter válido (`name`/`description`/`tools`). Guardian e validator exigem `tools: read, grep, find, ls` e `extensions: false` (read-only real); divergência = `blocked`, nunca despachar.
3. **Modelo por papel:** conferir `MODEL_POLICY.md` (frontmatter dos agent files é a fonte; `model`/`thinking` não são passados por chamada quando pinados).
4. Verificação visual opcional: `/agents → Agent types` (lista `•`/`◦`/`✕` e modelo efetivo).

Fonte, path ou tools divergentes indicam shadowing/configuração insegura: grave `blocked` e não despache.

## Dispatch (sintaxe real)

```text
Agent({
  subagent_type: "worker",
  prompt: "{task completa, com paths, write set, DoD e evidência exigida}",
  description: "{3-5 palavras}",
  // opcionais conforme a política: model, thinking, max_turns
  // run_in_background: true para paralelismo; depois get_subagent_result({ agent_id, wait: true })
})
```

- **`context: "fresh"` não é um parâmetro da tool.** O equivalente real: agent files com `prompt_mode: replace` + `skills: false` (não herdam prompt do pai nem skills) e **nunca** `inherit_context: true` na chamada. O prompt da chamada é o contexto; artefatos são lidos por path pelo child.
- **`cwd` não é um parâmetro da tool.** O child herda o cwd da sessão pai (o manager roda no project root). Para isolar filesystem, use `isolation: "worktree"` (nunca para guardians/validators). O cwd alternativo só existe no RPC `subagents:rpc:spawn` (`options.cwd`), para outras extensões.
- Chamada sem `async`/`run_in_background` já terminou quando retorna (foreground, resultado inline). Background retorna `agent_id`; completou → notificação; `get_subagent_result({ agent_id, wait: true })` bloqueia até o fim; `verbose: true` traz a conversa completa.
- `(no output)` não significa falha: reconstrua por diff, write set e evidência; nunca relance por ausência de texto nem consulte status por nome de agent.
- **Uma tentativa tem no máximo um dispatch por par papel+task.** Não duplique child no mesmo batch e não repita chamada apenas para obter outro formato de output; consuma o primeiro retorno e só abra nova tentativa após rejeição persistida.
- Para `batista-ux` e `batista-arch` independentes (write sets disjuntos): dois `Agent` em paralelo (`run_in_background: true` ambos, depois aguardar). Nunca paralelize writers com write sets sobrepostos.
- `resume` (retomar sessão anterior) e `schedule` são recursos da extensão, **fora** do fluxo dos managers.

## Managers na sessão raiz

`batista-loop`, `batista-manifest` e `batista-execute` permanecem na sessão raiz (que possui a tool `Agent`):

- `batista-loop` carrega `../skills/batista-manifest/SKILL.md` e `../skills/batista-execute/SKILL.md`, resolvidos a partir deste arquivo, com `read` e aplica essas rotinas inline, no mesmo turno.
- `batista-manifest` delega `batista-spec`, `batista-ux`, `batista-arch` e `batista-plan` a children `delegate`.
- `batista-execute` delega implementação a `worker` e aceite a `workflow-validator`.
- Uma rotina manager carregada por outra rotina não emite sua `Final Response`; devolve o controle ao manager chamador.

Não delegue um manager a um child comum: children não recebem a tool `Agent` e não conseguem orquestrar o próximo nível.

## Runtime ausente

Se a tool `Agent`/`get_subagent_result`/`steer_subagent` (ou algum papel obrigatório) estiver indisponível, grave `Status: blocked` e instrua `pi install npm:@tintinweb/pi-subagents` (e a instalação dos agentes de papel conforme `README.md`) seguido de reinício do Pi. Não simule guardian, worker ou validador inline e não marque `ready`/`done`.
