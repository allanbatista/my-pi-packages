# Workflow Common — Runtime, Delegação e Estado

Leia também `./PI_ADAPTATION.md` e `./MODEL_POLICY.md`, resolvendo os paths a partir deste arquivo.

## Runtime Pi

- `/skill:*` é entrada do usuário; nunca é mecanismo de chamada entre skills.
- `/subagents` administra a extensão; managers chamam a ferramenta `subagent(...)`.
- `loop`, `manifest` e `execute` rodam na sessão raiz. Um manager chama outro carregando o `SKILL.md` correspondente com `read` e continuando no mesmo turno.
- Skills folha e validators rodam em subagents com `context: "fresh"` e `cwd` explícito.
- Sem `subagent`, o workflow bloqueia com instrução de instalação; não falsifica independência inline.

## Preflight de agents

1. Rode `subagent({ action: "list" })`.
2. Para cada papel usado, rode `subagent({ action: "get", agent: "{name}" })` antes do primeiro dispatch desse mesmo papel; nome presente na lista ou `get` de outro papel não basta.
3. Exija `delegate` e `worker` com source `builtin`.
4. Exija `artifact-guardian` e `workflow-validator` com source `package` e tools exatamente `read, grep, find, ls`.
5. Source, path ou tools divergentes indicam shadowing/configuração insegura: grave `blocked` e não despache.

## Fronteira de paths

- Antes de escrever ou delegar, canonicalize o project root e o ancestral existente mais próximo do feature dir. O feature dir deve ficar em `{project-root}/.features/`, sem `..` nem escape por symlink.
- Normalize cada write set do worker contra o project root; rejeite path absoluto externo, `..` e symlink que resolva fora da raiz.
- `cwd` e write set são controles do workflow, não sandbox do sistema operacional. Modelo não confiável com ferramentas de escrita exige worktree/container descartável ou permission system; sem isso, bloqueie em vez de prometer confinamento.
- Antes de cada `write`/`edit`, o manager resolve o target e cancela a chamada se ele não for um `loop.md`, `manifest.md` ou `plan.md` selecionado. Path de produto errado, incompleto ou trivial sempre volta a worker; nem gap raiz autoriza o manager a criar, corrigir, mover, copiar ou remover produto.

## Dispatch

Autoria de `spec`, `ux`, `arch` ou `plan`:

Resolva primeiro o `SKILL.md` exato dentro deste package e confira seu `realpath`. Não use o parâmetro `skill: "{name}"`: a resolução por nome prioriza skills do projeto alvo e pode sofrer shadowing.

```text
subagent({
  agent: "delegate",
  model: "inherit",
  context: "fresh",
  cwd: "{canonical-project-root}",
  artifacts: false,
  acceptance: { level: "none", reason: "guardian separado" },
  task: "MODE: orchestrated\nRead and follow this exact package skill first: {absolute-package-skill-path}.\nObjective: ...\nProject root: ...\nFeature dir: ...\nRequired reads: ...\nAllowed writes: ...\nDo not call slash commands, talk to the user, or run a guardian. Missing material decision => persist questions and return blocked. Return only the Delegation Result."
})
```

Guardian de planejamento/outcome: `artifact-guardian`, `model: "inherit"`, `context: "fresh"`, `cwd: "{canonical-project-root}"`, sem permissão de escrita. Na execução, toda chamada informa explicitamente `cwd: "{canonical-project-root}"` e `model: "deepseek/deepseek-v4-flash:off"` para `worker` ou `model: "deepseek/deepseek-v4-flash:xhigh"` para `workflow-validator`; feature dir como `cwd`, `inherit`, campo ausente ou valor efetivo divergente é dispatch inválido e não pode promover task, fase ou sub-feature. Settings são fallback, não evidência do modelo usado.

Para `ux` e `arch` independentes, use uma única chamada `subagent({ tasks: [...], context: "fresh", concurrency: 2 })`. Não paralelize writers com write sets sobrepostos.

Uma tentativa tem no máximo um dispatch por par papel+task. Não duplique child no mesmo batch e não repita chamada apenas para obter outro formato de output; consuma o primeiro retorno e só abra nova tentativa após rejeição persistida.

Chamada `subagent` sem `async` já terminou quando retorna. `(no output)` não significa falha: reconstrua por diff, write set e evidência; nunca consulte `action: "status"` com nome de agent nem relance por ausência de texto.

## State Reconciliation — fail closed

Após cada delegação:

1. Releia o artefato declarado e os gates relacionados.
2. Nunca copie status apenas da resposta do child.
3. `ready` exige o status literal esperado, todos os gates obrigatórios `[x]`, zero pergunta/material `pending` e guardian real `approved`.
4. `done` exige evidência persistida e validação independente real; confira o primeiro campo `Status:` do `manifest.md`/`plan.md` e `manifest.md > State > Plan`, pois status de task/fase não substitui o cabeçalho; índice manager nunca pode ficar `done` enquanto documento, state, resume point, task ou fase correspondente estiver `ready|running|pending`.
5. Divergência entre índice e artefato rebaixa o índice ao estado real e vira blocker; resumo nunca promove status.
6. Uma decisão material com `a definir`, `pending` ou origem `suposição explícita` bloqueia o avanço e deve virar pergunta ao usuário.
7. Mudança substantiva no conteúdo de um artefato invalida seu guardian e todos os artefatos/guardians downstream: rebaixe para `draft|pending` antes do próximo dispatch. Persistir somente o verdict/gate/status da mesma revisão não invalida essa aprovação. Aprovação vale somente para a revisão/evidência que o guardian leu.
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
