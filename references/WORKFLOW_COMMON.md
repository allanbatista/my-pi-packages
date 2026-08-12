# Workflow Common — Runtime, Delegação e Estado

Leia também `./PI_ADAPTATION.md` (sintaxe real de delegação da extensão `@tintinweb/pi-subagents` v0.14.x) e `./MODEL_POLICY.md`, resolvendo os paths a partir deste arquivo.

## Runtime Pi

- `/skill:*` é entrada do usuário; nunca é mecanismo de chamada entre skills.
- `/agents` administra a extensão (menu humano); managers chamam a ferramenta `Agent(...)` registrada pela extensão.
- `batista-loop`, `batista-manifest` e `batista-execute` rodam na sessão raiz. Um manager chama outro carregando o `SKILL.md` correspondente com `read` e continuando no mesmo turno.
- Skills folha e validators rodam em children (`Agent`) com contexto mínimo e herança de cwd da sessão raiz; ver `PI_ADAPTATION.md`.
- Sem a extensão (`Agent`/`get_subagent_result`/`steer_subagent` indisponíveis), o workflow bloqueia com instrução de instalação; não falsifica independência inline.

## Preflight de agents (v0.14.x — substitui o antigo `action: list`/`get`)

1. Confirme a extensão ativa: as tools `Agent`, `get_subagent_result` e `steer_subagent` presentes no harness.
2. Para cada papel usado (`delegate`, `worker`, `workflow-validator`, `artifact-guardian`), confirme o arquivo do agente instalado em `~/.pi/agent/agents/` (ou `.pi/agents/` do projeto) com frontmatter válido; nome presente na lista de types da tool `Agent` não basta — leia o arquivo real.
3. Exija `worker` e `delegate` com tools de escrita (`read, bash, edit, write, grep, find, ls`).
4. Exija `artifact-guardian` e `workflow-validator` com tools exatamente `read, grep, find, ls` e `extensions: false` (read-only de verdade).
5. Tools, path ou frontmatter divergentes indicam shadowing/configuração insegura: grave `blocked` e não despache.

## Fronteira de paths

- Antes de escrever ou delegar, canonicalize o project root e o ancestral existente mais próximo do feature dir. O feature dir deve ficar em `{project-root}/.features/`, sem `..` nem escape por symlink.
- **Uma feature dir por escopo**: sub-feature no mesmo worktree (sequencial/single) usa **a própria feature dir do epic** — `manifest.md`, `spec.md`, `ux.md`, `arch.md`, `plan.md` e `validation.md` ficam na mesma pasta do `loop.md`, nunca em subpasta nova (`{feature-dir}/{nome}/` ou `{root}/{nome}/` é estrutura inválida). Sub-feature paralela = worktree próprio com sua `.features/{...}/`. Ao detectar artefatos em subpasta, mova-os para a feature dir canônica e corrija referências relativas (`../loop.md` → `loop.md` etc.) antes de qualquer dispatch.
- Normalize cada write set do worker contra o project root; rejeite path absoluto externo, `..` e symlink que resolva fora da raiz.
- A tool `Agent` herda o cwd da sessão raiz: o manager deve estar rodando no project root antes de despachar. Para isolar filesystem use `isolation: "worktree"` (nunca para guardians/validators). O cwd alternativo só existe no RPC `subagents:rpc:spawn` (`options.cwd`), para outras extensões.
- Antes de cada `write`/`edit`, o manager resolve o target e cancela a chamada se ele não for um `loop.md`, `manifest.md`, `plan.md` ou `validation.md` selecionado. Path de produto errado, incompleto ou trivial sempre volta a worker; nem gap raiz autoriza o manager a criar, corrigir, mover, copiar ou remover produto.

## Dispatch

Autoria de `batista-spec`, `batista-ux`, `batista-arch`, `batista-plan` ou `batista-validation`:

Resolva primeiro o `SKILL.md` exato dentro deste package e confira seu `realpath`. Não use o parâmetro `skill: "{name}"` (não existe na interface real): a resolução por nome prioriza skills do projeto alvo e pode sofrer shadowing. O child `delegate` recebe no prompt o path absoluto da skill e a lê.

```text
Agent({
  subagent_type: "delegate",
  prompt: "MODE: orchestrated\nRead and follow this exact package skill first: {absolute-package-skill-path}.\nObjective: ...\nProject root: ...\nFeature dir: ...\nRequired reads: ...\nAllowed writes: ...\nDo not call slash commands, talk to the user, or run a guardian. Missing material decision => persist questions and return blocked. Return only the Delegation Result.",
  description: "..."
})
```

`batista-validation` é autoria (planejamento): escreve somente `validation.md` da feature (não escreve produto) e requer seu próprio `artifact-guardian` aprovar antes da execução. Guardian de planejamento/outcome: `Agent({ subagent_type: "artifact-guardian", ... })`, sem permissão de escrita (tools read-only). Execução: `Agent({ subagent_type: "worker", ... })` e validação `Agent({ subagent_type: "workflow-validator", ... })` — os agent files **não pinam** `model`/`thinking` (ver `MODEL_POLICY.md`): a chamada repassa `model`/`thinking` somente quando o usuário indicar explicitamente; omitidos, o child herda o modelo da sessão raiz. O child herda o cwd da sessão raiz: sessão raiz fora do project root (feature dir como `cwd`) ou valor efetivo divergente é dispatch inválido e não pode promover task, fase ou sub-feature. Settings são fallback, não evidência do modelo usado.

Para `batista-ux` e `batista-arch` independentes (write sets disjuntos), dispare dois `Agent` com `run_in_background: true` e aguarde ambos. Não paralelize writers com write sets sobrepostos.

Uma tentativa tem no máximo um dispatch por par papel+task. Não duplique child no mesmo batch e não repita chamada apenas para obter outro formato de output; consuma o primeiro retorno e só abra nova tentativa após rejeição persistida.

## Canary de runtime (obrigatório antes do primeiro dispatch real)

Antes de qualquer dispatch de worker/validator de um run ou resume, despache um canary read-only: `Agent({ subagent_type: "worker", prompt: "Canary: sem escrever nada, reporte pwd; git rev-parse --show-toplevel; git branch --show-current; conectividade (ex.: gh auth status ou probe de rede). Retorne DELEGATION_RESULT com evidence.", description: "canary cwd/modelo", max_turns: 3 })`. Ele confirma:

1. **cwd real** == project root / worktree esperado da feature (quando o plano usa worktree, branch e root devem conferir com `~/Workspaces/worktrees/<repo>-<branch>`);
2. **modelo/thinking efetivo** == expectativa: o que o usuário indicou (sessão raiz ou pedido explícito) ou a indicação default da `MODEL_POLICY` (conferir no transcript do canary quando disponível; nunca por settings);
3. **conectividade** suficiente para o E2E.

Divergência em (1) → `blocked` com instrução literal de reiniciar o Pi no diretório correto e retomar do checkpoint; nunca despache E2E em cwd errado. O canary não escreve arquivos, não substitui o preflight de agents e conta como dispatch da tentativa (máximo um por par papel+task).

Todo dispatch declara `max_turns` explícito: canary baixo (ex.: 3); workers proporcionais ao escopo da fase, nunca ilimitado. Tasks amplas (E2E inteiro) são quebradas em fases com checkpoint obrigatório entre elas — uma task interrompida sem checkpoint retoma da fase, não do zero.

Chamada `Agent` sem `run_in_background` já terminou quando retorna (resultado inline). `(no output)` não significa falha: reconstrua por diff, write set e evidência; nunca consulte `get_subagent_result` por nome de agent nem relance por ausência de texto. Background retorna `agent_id`; aguarde com `get_subagent_result({ agent_id, wait: true })`.

## State Reconciliation — fail closed

Após cada delegação:

1. Releia o artefato declarado e os gates relacionados.
2. Nunca copie status apenas da resposta do child.
3. `ready` exige o status literal esperado, todos os gates obrigatórios `[x]`, zero pergunta/material `pending` e guardian real `approved`.
4. `done` exige evidência persistida e validação independente real; confira o primeiro campo `Status:` do `manifest.md`/`plan.md` e `manifest.md > State > Plan`, pois status de task/fase não substitui o cabeçalho; índice manager nunca pode ficar `done` enquanto documento, state, resume point, task ou fase correspondente estiver `ready|running|pending`.
5. Divergência entre índice e artefato rebaixa o índice ao estado real e vira blocker; resumo nunca promove status.
6. Uma decisão material com `a definir`, `pending` ou origem `suposição explícita` bloqueia o avanço e deve virar pergunta ao usuário.
7. Mudança substantiva no conteúdo de um artefato invalida seu guardian e todos os artefatos/guardians downstream: rebaixe para `draft|pending` antes do próximo dispatch. Mudança substantiva em `spec.md` ou `plan.md` rebaixa o `validation.md` para `draft` + guardian `pending`, e itens `pass` anteriores voltam a `pending` (a aprovação vale só para a revisão que o guardian leu). Persistir somente o verdict/gate/status da mesma revisão não invalida essa aprovação. Aprovação vale somente para a revisão/evidência que o guardian leu.
8. Replan, reexecução ou merge invalida o Outcome Guardian antes da mutação; só nova revisão pode restaurar `approved`.

## Delegation Result

Todo child orquestrado termina apenas com este envelope curto:

```text
DELEGATION_RESULT
status: ready | done | blocked | fail | not-applicable | approved | rejected
artifact: {path | none}
artifact_status: {valor literal | none}
guardian: {approved | rejected | pending | not-applicable}
questions: {none | IDs}
resume: {próxima ação | none}
blockers: {none | descrição}
evidence: {paths/comandos/achados}
```

O envelope é transporte, não fonte da verdade. Modelo simples pode omiti-lo: nesse caso, trate a resposta como hint e reconstrua o resultado somente por artefatos, diff e evidência verificável. Prossiga apenas se todos os campos necessários puderem ser confirmados independentemente; desconhecido vira blocker.

Para validators, ausência de rejeição não é aprovação. Só promova quando o retorno trouxer aprovação positiva explícita — `status: approved`/`guardian: approved` ou declaração inequívoca de que todos os critérios e o DoD passaram — além da evidência verificável. `pending`, `blocked`, silêncio ou texto ambíguo não promovem estado.

Para guardians, `evidence` lista cada critério como `pass|fail — critério — evidência`; qualquer `fail` exige `status: rejected`. Use `questions` para decisões faltantes, `resume` para a menor correção e `blockers` para críticas impeditivas. Não invente um segundo formato de retorno.

## Questions

- Child folha não conversa com o usuário. Persiste perguntas e retorna `blocked`.
- O manager raiz copia as perguntas materiais ao usuário e encerra o turno somente para aguardar respostas.
- Ao retomar, passa respostas com os mesmos IDs e reabre apenas a etapa bloqueada.

## Checkpoint

Antes de cada delegação ou de ceder o turno, grave `Updated`, status, resume point e blockers no artefato manager. Só ceda em stop condition, blocker externo ou pergunta real ao usuário.
