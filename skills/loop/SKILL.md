---
name: loop
description: Controlador de resultado (closed loop) de uma feature ou épico em `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/loop.md`. Garante que o objetivo é atingido, chamando `/skill:manifest` para autoria e `/skill:execute` para execução, e replanejando/reexecutando o menor ponto até fechar. Use como `/skill:loop` quando o usuário pedir para atingir um objetivo ponta a ponta, autopilot, decomposição em sub-features, execução sequencial/paralela, worktrees, merge/integração ou retomada de um objetivo long-running.
---

# Feature Loop

Use esta skill como controlador de resultado: dado um objetivo, garanta que ele é atingido de fato, decidindo decomposição, sequência/paralelismo e integração, e iterando (planejar/replanejar/executar/reexecutar) até fechar com evidência.

Esta é a camada mais externa do plugin. Ela orquestra `/skill:manifest` (autoria) e `/skill:execute` (execução); não escreve `spec`/`ux`/`arch`/`plan` direto nem implementa código de produto. Pode editar apenas `loop.md` e índices de coordenação.

Não use achismo: o objetivo só está atingido com evidência prática no caminho afetado. Registre como blocker qualquer premissa que não puder confirmar por arquivo, comando, log, teste, browser ou resposta do usuário.

Esta skill atua como manager. Execute `manifest` e `execute` em subagents isolados com `fork_context: false`, passando apenas objetivo/sub-feature, project root, feature dir e documentos necessários. Não dependa do contexto acumulado da sessão.

## Workflow

1. Leia o `AGENTS.md` do projeto.
2. Se o input for um `loop.md`, feature dir ou objetivo em texto, use como fonte: leia o estado existente antes de decidir.
3. Fixe o **objetivo verificável**: resultado esperado + evidência de aceite no nível do resultado (como saberemos que fechou). Se o objetivo for ambíguo ou não verificável, pergunte (standalone) ou registre blocker.
4. Identifique o project root e crie ou selecione o diretório do épico `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/` com `loop.md`.
5. **Decida a decomposição** (ver `Decomposition`): 1 feature vs N sub-features; para N, monte o DAG (dependências, write sets, sequencial vs paralelo). Registre a decisão e o racional em `loop.md`.
6. Para cada sub-feature liberada, delegue a autoria a `/skill:manifest` em subagent isolado (spec → ux ∥ arch → plan), passando objetivo da sub-feature, paths e docs.
7. Quando o manifest devolver docs `ready` e guardians aprovados, delegue a execução a `/skill:execute` em subagent isolado. Features paralelas rodam cada uma em seu worktree (ver `Worktrees & Merge`).
8. Execute batches de sub-features como batches: spawn das independentes primeiro, wait depois; serialize só as dependentes.
9. Ao fechar as sub-features de um batch, faça merge dos worktrees e rode a **integração E2E** cross-feature.
10. Dispare o **outcome guardian**: bate o resultado combinado contra o objetivo, com evidência.
11. **Gap → itera:** diagnostique a menor causa (spec? ux? arch? plano? implementação? integração?) e roteie para a camada certa — replaneja via `manifest`, reexecuta via `execute` ou re-decompõe. Cada iteração exige progresso mensurável e evidência.
12. Repita até uma `Stop Condition`. Atualize `loop.md` (resume point, convergence ledger) antes de ceder o turno.
13. Ao final, responda conforme `Final Response`.

## Decomposition

Decida com critério, não por conveniência:

| Sinal | Decisão |
|---|---|
| Superfície coesa, pequeno/médio, sem incrementos independentes | 1 feature (manifest único) |
| Abrange superfícies independentes, grande, ou incrementos que entregam/validam sozinhos | N sub-features |
| Sub-feature B precisa do contrato de A, ou compartilha write set | sequencial |
| Write sets disjuntos + validação independente | paralelo → 1 worktree por feature |

Mesma regra de write-set disjunto do `plan` (paralelismo de tasks), elevada para o nível de feature. Não paralelize features que compartilham arquivo, migração, contrato ou sequência de validação.

## Stop Conditions

Pare quando (ordem de preferência):

- **Converged**: objetivo atingido com evidência prática de resultado aprovada pelo outcome guardian.
- **Blocked**: decisão de produto ou dependência externa trava progresso seguro; registre o blocker exato e pergunte ao usuário.
- **Ceiling**: `Iterations used` ≥ `Iteration budget` (default 5), ou 3 iterações seguidas sem evidência nova em arquivo/comando/teste; pare e reporte estado, gap restante e próxima ação. Grave `Status: ceiling` no `loop.md` (equivale a `fail` no template legado).

Nunca itere em silêncio nem declare `converged` sem evidência. Cada iteração deve mudar algo mensurável em artefato ou evidência verificável.

### Anti-thrash

- Mesmo par `gap` + `causa` repetido **2×** no Convergence Ledger → `Status: blocked` (não reexecute à cega).
- Oscilação detectada (ex.: `impl`→`integração`→`impl` no mesmo gap) → `blocked` na 2ª volta.
- Iteração só conta como progresso se o ledger registrar evidência nova (path, comando, commit, teste) distinta da iteração anterior.

## Worktrees & Merge

- Para features paralelas com write sets disjuntos, execute cada uma em um worktree isolado.
- Não deixe workers de features diferentes escreverem no mesmo working tree.
- Após um batch paralelo, faça merge dos worktrees na ordem do DAG, resolva conflito como blocker (não sobrescreva mudança paralela) e só então rode a integração E2E.
- Se a integração falhar, registre gap e roteie a correção para a feature/camada certa; não conserte inline.

## `loop.md` Template

```markdown
# {Objetivo} — Loop

Status: running | converged | blocked | ceiling | fail
Created: {YYYY-MM-DD HH:MM}
Updated: {YYYY-MM-DD HH:MM}
Iteration budget: 5
Iterations used: {0}

## Objective

- Resultado esperado: {o que precisa ser verdade no fim}
- Evidência de aceite: {prova observável no nível do resultado}

## Strategy

- Decomposição: single | decomposed(N)
- Execução: sequential | parallel
- Racional: {por que essa estratégia}

## Sub-features

| Feature | Dir | Estratégia | Worktree | manifest | execute | Verify | Status |
|---|---|---|---|---|---|---|---|
| {nome} | ./{dir} | seq/paralelo | {branch/path ou none} | missing/ready/blocked | pending/running/done/fail | pending/pass/fail | pending/running/done/blocked |

## Convergence Ledger

- {iter} | gap: {descrição} | causa: {spec/ux/arch/plan/impl/integração} | ação: {replan/reexec/redecompose} | evidência: {ref} | resultado: {pass/fail/blocker}

## Integration

- Merge: {status/ordem}
- E2E: {evidência cross-feature ou pending}

## Outcome Guardian

Status: pending | approved | rejected
- {achado/pergunta/crítica que bloqueia o objetivo, ou none}

## Resume Point

- Última sub-feature concluída: {none}
- Próxima ação: {ação}
- Blockers: {none}
```

## Outcome Guardian

Ao fechar (ou a cada tentativa de `converged`), crie um subagent guardian com `model: gpt-5.5`, `reasoning_effort: xhigh`, `fork_context: false` e contexto mínimo: objetivo, `AGENTS.md`, `loop.md`, manifests/plans das sub-features e evidência produzida.

O guardian não edita arquivos e não valida task a task (isso é do `execute`). Ele valida o **objetivo end-to-end**: o resultado combinado das sub-features entrega o objetivo, a integração cross-feature funciona e há evidência prática — sem achismo.

Saída obrigatória do guardian:

```markdown
Status: approved | rejected
Questions: none | {perguntas que bloqueiam o objetivo}
Critiques: none | {gaps entre resultado e objetivo}
Required changes: none | {menor correção para fechar}
```

`Status: rejected` força nova iteração roteada à camada certa. Só use `Status: converged` no `loop.md` com guardian `approved`.

## Rules

- O objetivo do loop é resultado atingido com evidência, não docs escritos nem código que "parece certo".
- Delegue autoria a `manifest` e execução a `execute`; não escreva `spec`/`ux`/`arch`/`plan` direto nem implemente produto.
- Toda sub-feature passa por `manifest` (autoria + guardians) antes de `execute`.
- Execute batches paralelos como batches: spawn primeiro, wait depois; um worktree por feature paralela; merge só depois.
- Não paralelize features com arquivo, migração, contrato ou validação compartilhados.
- Cada iteração corrige o menor ponto que fecha o gap; não replaneje tudo por hábito.
- Não declare `converged` sem outcome guardian aprovado e evidência de integração E2E quando houver mais de uma feature.
- Pare em blocker duro (decisão de produto/dependência externa) e pergunte; não invente resposta.
- Respeite `Iteration budget`; incremente `Iterations used` a cada loop; aplique regras de `Anti-thrash`.
- Ao retomar, comece pelo resume point do `loop.md` e revalide o estado antes de delegar.
- O que sobrevive ao objetivo vai pro projeto (`AGENTS.md`, skills project-local, `docs/adr`); o que morre com a feature fica em `.features/{...}/`.

## Checkpoint (obrigatório)

Antes de **cada** delegação a `manifest`/`execute`, merge ou de ceder o turno, grave no `loop.md`: `Updated:`, `Iterations used`, resume point, última linha do Convergence Ledger e Outcome Guardian. Não delegue com `loop.md` desatualizado.

## State & Memory

- Fonte da verdade é o arquivo, não o contexto. Escreva o delta no `loop.md` (e docs de feature) antes de seguir para o próximo passo (write-before-forget).
- O contexto de trabalho guarda só: épico dir, sub-feature/iteração atual, blockers abertos, próxima ação. O resto é ponteiro (path + resume point) e se re-lê sob demanda.
- Antes de ceder o turno ou compactar: garanta resume point e evidência reais no arquivo; colapse o convergence ledger para os últimos 10 + rollup por sub-feature; descarte transcripts de `manifest`/`execute` (guarde só {docs, evidência, gap}).
- Compactar = projetar em ponteiro, nunca inventar. Resumo jamais faz upgrade de status. Em divergência, o arquivo vence e re-lê.

## Context Isolation

- Passar a cada subagent (`manifest`/`execute`/guardian) só o objetivo/sub-feature, paths, feature dir, worktree e docs necessários.
- Usar `fork_context: false`; nunca usar o histórico completo da sessão como contexto do subagent.
- Se subagents ou worktrees não estiverem disponíveis, registrar blocker/pending no `loop.md` e declarar na resposta final.

## Final Response

Ao concluir, responda com:

- `Objetivo`: o objetivo verificável e o status (`converged` | `blocked` | `fail`).
- `Estratégia`: decomposição, batches paralelos/sequenciais e worktrees usados.
- `Executado`: sub-features concluídas, iterações de replan/reexec e merge/integração.
- `Evidência`: prova de resultado end-to-end aprovada pelo outcome guardian.
- `Pendências`: blockers, decisões abertas ou `none`.
- `Resume`: épico dir, resume point e próxima ação.
