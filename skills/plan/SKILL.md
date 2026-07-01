---
name: plan
description: Cria, revisa e mantém apenas o `plan.md` técnico de uma feature em `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/plan.md`, a partir de `spec.md` e das soluções `ux.md`/`arch.md` quando aplicáveis. Use como `/skill:plan` quando o usuário pedir plano técnico, mapa de impacto, investigação técnica, fases, tasks, subagents, paralelismo, plano paralelizável, validação, harness, loop engineering ou revisão de uma feature existente. Para executar o plano, use `/skill:execute`.
---

# Feature Plan


## Pi Runtime

No Pi, a delegação padrão é **inline** com isolamento de contexto (ver `references/PI_ADAPTATION.md`). Use `spawn_agent`/`fork_context` apenas quando o runtime oferecer paridade Codex. Invoque skills filhas via `/skill:<name>`. Não bloqueie o workflow por indisponibilidade de subagent.
## Delegação

Siga `references/PI_ADAPTATION.md` e `references/MODEL_POLICY.md`:
- **Padrão Pi**: execução inline na sessão atual, contexto mínimo (pedido, paths, `AGENTS.md`, docs da feature).
- **Modelo (planejamento)**: herde **modelo e effort da sessão principal** — sem override de modelo/thinking.
- **Subagent opcional**: `planner`, `oracle` ou `delegate` sem `agentOverrides`; guardians de artefato **não** usam `reviewer` (reservado à validação de execução).
- **Guardian**: passo separado (inline ou subagent) que aplica rubrica sem editar arquivos.
- **Paralelo**: batch paralelo quando suportado; senão serialize com write sets verificados.


Use esta skill para transformar uma spec pronta em plano técnico executável.

Esta skill só pode editar documentos de workflow da feature. Não edite código de produto, testes, configs, migrations ou arquivos fora da pasta da feature.

Não use achismo: investigue antes de concluir, cite evidência concreta para fatos e registre como blocker qualquer premissa que não puder confirmar por arquivo, comando, log, teste, browser ou resposta do usuário.

Quando invocada por outra skill do feature-workflow, execute com isolamento de contexto (inline por padrão no Pi; subagent opcional — ver `references/PI_ADAPTATION.md`), recebendo apenas pedido, project root, feature dir e docs necessários.

## Workflow

1. Leia o `AGENTS.md` do projeto.
2. Se o input for um diretório de feature ou arquivo (`manifest.md`, `spec.md` ou `plan.md`), use-o como fonte: leia os arquivos existentes da feature antes de decidir status.
3. Localize o `spec.md` da feature. Se não existir, use `/skill:spec` primeiro. Leia também `ux.md` e `arch.md` quando existirem (fontes de solução: usabilidade e arquitetura); reconcilie conflito de contrato entre elas e registre blocker se não resolvível.
4. Revise o estado existente: perguntas pendentes, decisões contraditórias, DoD fraco, contrato/persistência/harness ausentes, divergência entre spec/plan/manifest e evidência faltante.
5. Se `spec.md` estiver `draft` ou `blocked`, não invente decisões de produto; registre o bloqueio.
6. Antes de planejar implementação, faça preflight: AGENTS, Graphify quando existir, worktree, contratos afetados, arquivos existentes/novos e comandos de validação disponíveis.
7. Produza `Impact Map` antes de fases/tasks: superfícies afetadas, evidência, arquivos/owners, necessidade de mudança, validação e risco. Tasks de backend derivam de decisões do `arch.md`; tasks de frontend derivam de decisões do `ux.md`. O plano é o ponto de reconciliação das duas soluções paralelas.
8. Cada task/fase deve nascer de uma ou mais linhas do `Impact Map`.
9. Monte um DAG de fases/tasks: dependências, write sets, validações compartilhadas e pontos de sincronização.
10. Agrupe em batches paralelos sempre que tasks/fases forem independentes, tiverem write sets disjuntos e validação própria.
11. Se contrato, persistência, harness, Impact Map ou arquivos alvo estiverem ambíguos, registre blocker no `plan.md` com `Escalation: spec | ux | arch | manifest` e devolva ao manager — esta skill **não** edita `spec.md`, `ux.md` nem `arch.md`; não crie plano executável por chute.
12. Crie ou atualize somente `plan.md`.
13. Depois de escrever/revisar, rode guardian independente (inline ou subagent) para validar `plan.md` contra `spec.md`.
14. Se o guardian rejeitar, aplique o menor ajuste necessário no `plan.md` ou registre blocker e repita a validação. Não conclua com guardian pendente ou rejeitado.
15. Atualize status antes e depois de cada task durante execução.
16. Ao final, responda ao usuário com um resumo curto do plano e do que será feito.

## Template

```markdown
# {Feature} Execution Plan

Status: pending | running | done | fail
Spec: ./spec.md
Updated: {YYYY-MM-DD HH:MM}

## Execution Rules

- Atualizar status antes e depois de cada task.
- Não marcar `done` sem evidência prática de funcionamento.
- Registrar arquivos reais quando divergirem dos planejados.
- Registrar blocker com causa, impacto e próxima ação.
- Não iniciar implementação se contrato, persistência, harness ou arquivos alvo exigirem adivinhação.
- Testes automáticos focados pertencem ao worker da task; suíte ampla pertence ao gate final da fase.

## Readiness Gates

- [ ] `AGENTS.md` lido.
- [ ] Solução consumida: `ux.md` e `arch.md` aplicáveis lidos e reconciliados (ou `not-applicable`).
- [ ] Graphify verificado e usado quando configurado.
- [ ] Worktree sujo registrado, com regra para não sobrescrever mudanças paralelas.
- [ ] Contratos públicos/internos e persistência definidos ou marcados como `none`.
- [ ] Arquivos alvo existentes/novos conferidos.
- [ ] Impact Map completo, com evidência para cada superfície.
- [ ] Harness mínimo definido com baseline, teste focado e validação final.
- [ ] Guardian aprovou o plano contra a spec e as soluções (`ux`/`arch`) aplicáveis.

## Impact Map

| Surface | Evidence | Why it matters | Files/Owners | Change? | Validation | Risk/Notes |
|---|---|---|---|---|---|---|
| {backend/frontend/job/infra/API/browser/etc.} | {arquivo, comando, log, teste, browser ou decisão} | {impacto no requisito} | {paths/owners} | {yes/no/pending} | {check concreto} | {risco ou blocker} |

## Phase 0: Preflight

Status: pending | running | done | fail
Owner/Subagent: main
Dependencies: none
DoD:
- [ ] Execução consegue começar sem adivinhar decisões.
Required Evidence:
- `AGENTS.md` lido, Graphify/worktree verificados, Impact Map completo, arquivos alvo conferidos, comandos de validação definidos.
Produced Evidence:
- {pending}
Blockers:
- {none}

## Phase 1: {Name}

Status: pending | running | done | fail
Owner/Subagent: {main | subagent-name | unassigned}
Dependencies: {none | phase/task}
Parallel Group: {sequential | batch-id}
DoD:
- [ ] {Resultado verificável da fase}
Required Evidence:
- {evidência prática: browser, API, consumer, log, smoke manual, comando/output, screenshot ou teste focado}
Produced Evidence:
- {pending}
Blockers:
- {none}

### Task 1.1: {Name}

Status: pending | running | done | fail
Owner/Subagent: {main | subagent-name | unassigned}
Parallel Group: {sequential | batch-id}
Planned Files:
- {path}
Write Set:
- {paths/patterns owned by this task}
Actual Files:
- {pending}
DoD:
- [ ] {Resultado verificável da task}
Required Evidence:
- {evidência mínima}
Produced Evidence:
- {pending}
Blockers:
- {none}

## Parallelism

- Batch 1: {tasks/fases independentes que podem iniciar juntas}
- Batch 2: {tasks/fases liberadas após Batch 1}
- Must stay sequential: {tasks/fases com dependência, write set compartilhado ou validação bloqueante}
- Synchronization points: {onde esperar validação antes do próximo batch}

## Validation Harness

- Baseline: {comando antes do patch ou motivo para pular}
- Task-scoped automated tests: {testes/typecheck/lint/build focados que o worker deve rodar para o escopo alterado}
- Integration/API/consumer: {commands, probes, logs, fixtures}
- Browser/UI: {URL, steps, selectors, screenshot/console/network evidence}
- Phase final validation: {suíte ampla/final checks a rodar no fim da fase, com correção por worker se falhar}
- Practical evidence: {prova observável de que o comportamento afetado funcionou}
- Graphify: {update/sync command when source architecture changed, or none}
- Regression loop: {run -> inspect failure -> patch smallest point -> rerun -> record evidence}

## Loop Ledger

- {timestamp} | Command: {cmd} | Result: {pass/fail/blocker} | Next action: {action}

## Guardian Review

Status: pending | approved | rejected
Questions:
- {none | perguntas que bloqueiam execução}
Critiques:
- {none | críticas que bloqueiam execução}
Required Changes:
- {none | ajustes obrigatórios}

## Resume Point

- Last completed task: {none}
- Next task: {task}
- Current blockers: {none}
```

## Artifact Guardian

Após atualizar `plan.md`, rode guardian independente (inline ou subagent) com contexto mínimo: pedido do usuário, project root, `AGENTS.md`, feature dir, `manifest.md` quando existir, `spec.md`, `ux.md` e `arch.md` quando existirem, `plan.md` e evidências citadas.

O guardian não edita arquivos. Ele valida aderência à spec e às soluções (`ux`/`arch`) aplicáveis, Impact Map, arquivos alvo, write sets, DAG, batches paralelos, pontos de sincronização, harness, DoD, blockers, ponto de retomada e evidência sem achismo.

Saída obrigatória do guardian:

```markdown
Status: approved | rejected
Rubric:
- [pass/fail] Impact Map cobre todas as `Validation surfaces` da spec (ou justifica `not-applicable`).
- [pass/fail] Tasks de frontend derivam de `ux.md`; tasks de backend derivam de `arch.md` (ou da spec quando solução N/A).
- [pass/fail] Conflitos `ux`↔`arch`↔`Shared Contract` resolvidos no plano ou escalados com `Escalation` explícita.
- [pass/fail] Write sets, DAG, batches e pontos de sincronização são explícitos e seguros.
- [pass/fail] Harness cita comandos/checks concretos; sem placeholders genéricos.
Questions: none | {perguntas que bloqueiam execução}
Critiques: none | {críticas que bloqueiam execução}
Required changes: none | {ajustes obrigatórios}
```

Qualquer item `fail` na rubrica força `Status: rejected`. Se `Status: rejected`, copie o feedback para `Guardian Review`, corrija `plan.md` quando a resposta já estiver disponível ou registre blocker com `Escalation` quando faltar decisão/evidência. Só entregue plano executável ou `Status: done` com `Status: approved`.

## Rules

- Status permitido: `pending`, `running`, `done`, `fail`.
- Não planeje arquivos, comandos, harness, dependências ou paralelismo por suposição; confirme no repo ou registre blocker.
- Não marque `plan.md` como executável sem `Impact Map` completo.
- Cada task/fase deve referenciar uma superfície mapeada; superfície sem evidência vira blocker/pending.
- Prefira plano paralelizável quando seguro: dividir tasks por write set disjunto, contrato independente e validação própria.
- Não serialize tasks independentes por conveniência; registre batch paralelo explícito.
- Não paralelize tasks que compartilham arquivo, migração, estado, contrato, fixture crítica ou validação sequencial.
- Mesmo se o usuário disser "corrija", "implemente" ou "execute", esta skill deve criar/refinar `plan.md` e encaminhar execução para `/skill:execute`; não faça patch de produto.
- Cada fase e task deve ter DoD próprio, owner/subagent, arquivos planejados/reais, evidência exigida/produzida e blockers.
- Toda feature deve ter `Phase 0: Preflight` e `Readiness Gates`.
- O harness deve citar comandos/checks práticos concretos ou registrar blocker; placeholders genéricos não bastam para execução.
- Teste referenciado que ainda não existe deve aparecer como arquivo novo planejado.
- Não exija suíte completa a cada task; planeje testes automáticos focados por task e suíte ampla/final checks no fechamento da fase.
- Definição de pronto exige evidência prática de funcionamento, não apenas revisão de código ou leitura de diff.
- Paralelize apenas tasks independentes e registre dependências, write sets e pontos de sincronização.
- Para long-running work, mantenha checkpoints, evidência e ponto de retomada.
- Ao receber arquivo ou diretório existente, trate a tarefa como revisão: corrija/refine o `plan.md` antes de concluir e não aceite status pronto herdado sem checagem.
- Se a revisão revelar decisão de produto pendente, registre blocker no `plan.md` com `Escalation: spec` (ou `ux`/`arch`) e devolva ao `manifest` — não edite outros artefatos.
- Não marque `done` se qualquer fase/task ainda tiver blocker, evidência `pending`, DoD sem prova ou guardian não aprovado.
- Se existir `manifest.md`, atualize apenas status/resume point quando necessário.
- Quando o usuário pedir execução, retomada operacional ou coordenação de workers, encaminhe para `/skill:execute`.
- Não aceite guardian genérico; ele deve listar evidência conferida ou bloquear com pergunta/crítica objetiva.

## Skill Extraction

Tarefa repetitiva vira skill do projeto, não boilerplate recopiado no plano.

- Gatilho: a mesma receita (sequência de passos/comandos/validação) aparece em ≥ 2–3 tasks/fases do plano, ou já apareceu em features anteriores. Registre o candidato como nota no `plan.md`.
- Ação: planeje uma task de extração que delega a um subagent (convenções de `create-skill` / `skill-creator` do ambiente) a implementação de uma skill project-local em `{project}/skills/{skill-name}/`, com guardian de validação. As tasks seguintes passam a chamar a skill em vez de re-derivar.
- A extração roda **somente** no worktree principal (branch base), **após** merge de features paralelas, **uma por vez** — nunca em paralelo com outra extração nem com worktrees de sub-feature. Write set exclusivo: `{project}/skills/{skill-name}/`.
- Guardrail (YAGNI de skill): one-off não vira skill. Só planeje extração com repetição real e procedimento estável.

## Checkpoint (obrigatório)

Antes de **cada** guardian, batch paralelo ou de ceder o turno, grave no `plan.md`: `Updated:`, resume point, blockers e última evidência. Não dispare guardian com `plan.md` desatualizado.

## State & Memory

- Fonte da verdade é o arquivo, não o contexto. Escreva o delta no `plan.md` (status, evidência, loop ledger, resume point) antes de seguir (write-before-forget).
- O contexto guarda só: feature dir, fase/task atual, blockers abertos, próxima ação. O resto é ponteiro (path + resume point) e se re-lê sob demanda.
- Antes de ceder o turno ou compactar: garanta resume point e evidência reais no arquivo; colapse o `Loop Ledger` para os últimos 10 + rollup por fase; descarte transcripts de subagent (guarde só {arquivos, comandos, evidência}).
- Compactar = projetar em ponteiro, nunca inventar. Resumo jamais faz upgrade de status (pending→done). Em divergência, o arquivo vence e re-lê.
- Roteamento de memória: o que sobrevive à feature (decisão de arquitetura durável, procedimento repetido virado skill) vai pro projeto; o efêmero fica em `.features/{...}/`.

## Context Isolation

- Quando houver manager, aceitar invocação orchestrated com contexto mínimo (inline por padrão no Pi).
- Não herdar contexto irrelevante da sessão manager.
- Passar somente artefatos mínimos: pedido, paths, `AGENTS.md`, `spec.md`, `ux.md`/`arch.md` aplicáveis e documentos da feature.
- Se subagents não estiverem disponíveis, siga `references/PI_ADAPTATION.md` (execução inline com isolamento de contexto); declare a limitação na resposta final e não use contexto oculto como evidência.

## Final Response

Ao concluir, responda com:

- `Resumo`: objetivo técnico do plano e status.
- `Será feito`: fases/tasks principais, batches paralelos e ordem de sincronização.
- `Impacto mapeado`: superfícies afetadas e evidência principal.
- `Validação planejada`: comandos, browser/API/consumer checks e evidências esperadas.
- `Pendências`: blockers, decisões abertas ou `none`.
- `Evidência`: arquivos lidos/atualizados e fatos confirmados que sustentam o plano.
