---
name: batista-execute
description: Coordena a execução de uma feature a partir de `manifest.md`, `spec.md` e `plan.md`, delegando implementação a subagents e validação a um subagent independente. Use como `/skill:batista-execute` quando o usuário pedir execução, retomada, coordenação de tasks/fases, paralelismo operacional ou validação independente do workflow.
---

# Feature Execute


## Runtime & Delegação

Leia e siga `../../references/WORKFLOW_COMMON.md` para runtime Pi, delegação, isolamento, reconciliação de estado e checkpoints.


Use esta skill para transformar a sessão atual em manager de execução. O manager coordena, registra progresso e delega; não implementa código nem valida a própria implementação.

O manager pode editar documentos de workflow da feature. Código de produto, testes, configs e migrations só podem ser alterados por um child **worker** lançado pela ferramenta `subagent`.

### Write Boundary — fail-closed

`write`/`edit` do manager têm allowlist fechada: `loop.md`, `manifest.md` e `plan.md` selecionados. Qualquer outro path pertence ao worker, inclusive arquivo trivial, teste, config, cópia, rename ou correção de path. Se o worker escrever no lugar errado ou deixar mudança incompleta, registre a rejeição e lance um novo worker de correção; o manager nunca move, copia, recria ou conserta o produto.

Não use achismo: investigue antes de delegar ou concluir, exija evidência concreta de workers/validadores e registre blocker qualquer premissa que não puder confirmar por arquivo, comando, log, teste, browser ou resposta do usuário.

Pronto não significa "o código parece certo". Pronto significa validação prática com evidência de funcionamento no caminho afetado.

Workers e validadores recebem apenas contexto mínimo (task/fase, paths, spec/plan/manifest, evidência). Aplique `../../references/MODEL_POLICY.md`: worker `deepseek/deepseek-v4-flash:off`; `workflow-validator` com `deepseek/deepseek-v4-flash:xhigh`.

## Workflow

1. Leia o `AGENTS.md` e aplique o preflight de agents de `../../references/WORKFLOW_COMMON.md`; confirme `worker` builtin e `workflow-validator` do package com allowlist read-only exata.
2. Canonicalize project root, feature dir e write sets conforme `../../references/WORKFLOW_COMMON.md`. Se o input resolver para feature dir ou arquivo existente, selecione-o e releia o estado; não crie outra feature.
3. Reconcile `manifest.md`, `spec.md`, `plan.md` e slices de `ux.md`/`arch.md`. Só execute com manifest/spec/plan `ready`, guardians obrigatórios `approved`, gates `[x]`, zero pergunta material e task executável. Uma correção raiz de task existente é elegível somente após a transição completa de `Root Correction Reopen`; `done` parcial não é runnable.
4. Se houver divergência ou lacuna de autoria, persista `blocked` e devolva ao `batista-manifest`; não corrija artefatos folha nem execute por suposição.
5. Ao retomar task `running`, confira owner, diff e evidência persistida antes de relançar; não duplique trabalho já aplicado.
6. Capture baseline do worktree e atualize `manifest.md`/`plan.md`: task/fase `running`, owner, write set, resume point e evidência exigida.
7. Lance **worker** com `model: "deepseek/deepseek-v4-flash:off"`, `context: "fresh"`, `cwd: "{canonical-project-root}"` — nunca feature dir — e escopo fechado: task, write set, DoD, evidência prática, slices relevantes e testes focados permitidos.
8. Para batch paralelo, use uma chamada `subagent({ tasks: [...], context: "fresh" })` somente com write sets disjuntos; inicie todos antes de aguardar.
9. Após cada worker síncrono, compare o diff real com baseline/write set e persista arquivos, comandos, resultados e evidência. Resposta `(no output)` ou envelope ausente **não é falha nem autoriza retry**: inspecione o write set/evidência e siga ao validator se o resultado existir. Não chame `action: "status"` com nome de agent; status serve somente para run async com ID real. Relato do child não promove status.
10. Lance **um único workflow-validator por task/tentativa** com `model: "deepseek/deepseek-v4-flash:xhigh"`, `context: "fresh"`, `cwd: "{canonical-project-root}"` e os artefatos/evidências reais. Aguarde e consuma esse retorno; nunca duplique o mesmo validator no mesmo batch nem o relance apenas para mudar `output`. Ele apenas inspeciona a evidência persistida com ferramentas read-only. Ausência de rejeição não basta: exija aprovação positiva explícita conforme `WORKFLOW_COMMON`; retorno `pending`, `blocked`, silencioso ou ambíguo não promove a task.
11. Se rejeitado ou se diff/write set/path divergir, registre causa e delegue a menor correção a novo worker. Não corrija diretamente, nem mesmo uma linha ou move/copy; repetição da mesma causa sem evidência nova vira blocker.
12. Ao fechar fase, delegue ao worker o gate final previsto no plano. Não rode suíte completa a cada task por hábito.
13. Marque task/fase `done` somente após validator `approved`; com todas as fases e evidências aprovadas, feche o estado atomicamente antes de devolver o controle: primeiro `Status:` de `plan.md` e `manifest.md` em `done`, `manifest.md > State > Plan: done`, resume points sem próxima task e todas as tasks/fases `done`. Releia ambos; qualquer divergência mantém a execução `running`.
14. Se esta rotina foi carregada pelo `batista-loop`, não emita `Final Response`: devolva o controle ao loop no mesmo turno. Em standalone, responda conforme `Final Response`.

## Manager Boundaries

- Pode editar `manifest.md` e `plan.md` para status, blockers, evidência, loop ledger e resume point.
- Pode pedir clarificação ao usuário quando uma decisão bloquear execução segura.
- Não pode implementar código, corrigir testes, alterar arquivos de produto ou declarar validação própria como suficiente.
- Se não houver ferramenta `subagent`, siga `../../references/PI_ADAPTATION.md`: bloqueie; não simule worker ou validador inline.

## Delegation Prompts

Implementation worker:

```text
Você é o worker responsável por executar somente esta task/fase.
Modelo: deepseek/deepseek-v4-flash:off.
Leia AGENTS.md, spec.md, plan.md e o slice relevante de arch.md/ux.md.
Escopo: {task/fase}
Parallel batch: {batch-id | sequential}
Arquivos/responsabilidade: {write set}
DoD: {DoD}
Evidência prática exigida: {required evidence}
Testes automáticos permitidos: rode apenas testes focados no que esta task altera, salvo exigência explícita do plano.
Não reverta mudanças de outros agentes; adapte-se a edições paralelas.
Implemente o menor diff seguro.
Retorne `DELEGATION_RESULT` e um delta estruturado: files_changed, commands_run com exit code, evidence_produced e follow_ups/blockers.
Se notar uma receita que já se repetiu (≥2-3 vezes), sinalize como candidato a skill de projeto no follow_ups.
```

Validation worker:

```text
Você é o validador independente desta task/fase.
Modelo: deepseek/deepseek-v4-flash:xhigh.
Leia AGENTS.md, spec.md, plan.md e o resultado do worker.
Não implemente correções.
Não execute comandos ou testes; eles pertencem ao worker ou ao gate final de fase.
Confira a evidência executável/observável já produzida: browser, API, consumer, logs, smoke manual, comandos com outputs e artefatos.
Reprove se houver apenas leitura de código, evidência genérica ou teste sem prova do comportamento afetado.
Verifique alinhamento com requisitos, DoD, arquivos esperados, evidência prática produzida e regressões óbvias.
Retorne somente `DELEGATION_RESULT` com approved/rejected, evidência conferida e correção mínima.
```

## Rules

- Toda implementação passa por worker e todo aceite passa por validador separado.
- Worker e validador devem seguir `../../references/MODEL_POLICY.md` (modelo/effort distintos do planejamento).
- Worker e validador são children separados via `subagent`, ambos com `context: "fresh"`; nunca use histórico completo da sessão manager.
- Execute batches paralelos como batches: spawn primeiro, wait depois; não serialize tasks independentes.
- Workers podem rodar testes automáticos focados no escopo da task; suíte completa fica para gate final de fase ou exigência explícita.
- Validadores não executam testes automáticos. Eles conferem evidência prática e bloqueiam entrega fraca.
- Não aceite relato genérico de worker/validador; exija arquivos alterados, comandos executados, resultado e evidência conferível de funcionamento.
- O manager registra, coordena e decide próximo passo operacional; não julga sozinho que a implementação está correta.
- Não use paralelismo quando tasks compartilham arquivos, estado, migração, contrato ou sequência de validação.
- Não marque `done` com blocker, pergunta pendente, evidência prática ausente, evidência `pending`, teste falho ou validação independente ausente.
- Ao retomar uma feature, comece pelo resume point do manifesto/plano e revalide o estado antes de delegar.

## Skill Extraction

Tarefa repetitiva vira skill do projeto, não boilerplate reexecutado a cada task.

- Gatilho: a mesma receita (sequência de passos/comandos/validação) aparece ≥ 2–3 vezes, dentro da feature ou entre features (workers sinalizam candidatos no `follow_ups`). Registre no loop ledger/`plan.md`.
- Ação: delegue a um `worker` a criação da skill project-local em `{project}/skills/{skill-name}/`, seguido de `workflow-validator`. As próximas tasks usam a skill em vez de re-derivar.
- Roda **somente** no worktree principal, **após** merge, **uma extração por vez** — nunca em paralelo com worktrees de sub-feature nem com outra extração. Write set exclusivo: `{project}/skills/{skill-name}/`.
- Guardrail (YAGNI de skill): one-off não vira skill. Só extraia com repetição real e procedimento estável.

## Checkpoint (obrigatório)

Antes de **cada** spawn de worker/validador ou de ceder o turno, grave em `plan.md`/`manifest.md`: task/fase `running` ou resultado, resume point e blockers. Não spawn worker com resume point desatualizado.

## State & Memory

- Fonte da verdade é o arquivo, não o contexto. Escreva o delta em `plan.md`/`manifest.md` (status, evidência, resume point) antes de liberar o próximo batch (write-before-forget).
- O contexto do manager guarda só: feature dir, batch/task atual, blockers abertos, próxima ação. Transcripts de worker/validador viram delta {files, commands, evidence} no arquivo e saem do contexto.
- Antes de ceder o turno ou compactar: garanta resume point e evidência reais; colapse ledgers longos para últimos 10 + rollup. Compactar = projetar em ponteiro, nunca inventar; resumo jamais faz upgrade de status; em divergência o arquivo vence.
- Learnings flush: ao fechar a feature, promova o durável (convenções, decisões de arquitetura, procedimentos virados skill) para o projeto (`AGENTS.md`, skills project-local, `docs/adr`); o efêmero morre com `.features/{...}/`.

## Context Isolation

- Passar a cada delegação (worker/validador) somente task/fase, paths, write set, DoD, evidência exigida, slice de `arch.md`/`ux.md` e docs da feature.
- Não passar conversa inteira, raciocínio prévio ou contexto não referenciado nos documentos.
- Se um subagent precisar de contexto extra, registrar qual artefato faltou e enviar só esse artefato.

## Final Response

Ao concluir, responda com:

- `Executado`: tasks/fases concluídas, batches paralelos executados, workers usados, arquivos alterados e evidência aprovada.
- `Falhou`: tasks/fases reprovadas, causa, evidência e próxima correção.
- `Pendente`: blockers, decisões abertas, validações faltantes ou `none`.
- `Como validar`: comandos/checks que o usuário pode rodar e resultado esperado.
- `Resumo final`: status da feature, resume point e próxima ação.

Quando carregada pelo `batista-loop`, não produza esta resposta humana; continue o controlador com o estado persistido.
