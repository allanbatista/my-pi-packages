---
name: execute
description: Coordena a execução de uma feature a partir de `manifest.md`, `spec.md` e `plan.md`, delegando implementação a subagents e validação a um subagent independente. Use como `/skill:execute` quando o usuário pedir execução, retomada, coordenação de tasks/fases, paralelismo operacional ou validação independente do workflow.
---

# Feature Execute


## Pi Runtime

No Pi, a delegação padrão é **inline** com isolamento de contexto (ver `references/PI_ADAPTATION.md`). Use `spawn_agent`/`fork_context` apenas quando o runtime oferecer paridade Codex. Invoque skills filhas via `/skill:<name>`. Não bloqueie o workflow por indisponibilidade de subagent.
## Delegação

Siga `references/PI_ADAPTATION.md`:
- **Padrão Pi**: execução inline na sessão atual, contexto mínimo (pedido, paths, `AGENTS.md`, docs da feature).
- **Opcional**: subagent via `spawn_agent` quando disponível; `fork_context: false` e model pinning são opcionais.
- **Guardian**: passo separado (inline ou subagent) que aplica rubrica sem editar arquivos.
- **Paralelo**: batch paralelo quando suportado; senão serialize com write sets verificados.


Use esta skill para transformar a sessão atual em manager de execução. O manager coordena, registra progresso e delega; não implementa código nem valida a própria implementação.

O manager pode editar documentos de workflow da feature. Código de produto, testes, configs e migrations só podem ser alterados pelo papel **worker** (inline ou subagent).

Não use achismo: investigue antes de delegar ou concluir, exija evidência concreta de workers/validadores e registre blocker qualquer premissa que não puder confirmar por arquivo, comando, log, teste, browser ou resposta do usuário.

Pronto não significa "o código parece certo". Pronto significa validação prática com evidência de funcionamento no caminho afetado.

Workers e validadores recebem apenas contexto mínimo (task/fase, paths, spec/plan/manifest, evidência). Model pinning (`gpt-5.*`, `reasoning_effort`) é opcional — ignore quando não suportado. Delegação inline por padrão no Pi (ver `references/PI_ADAPTATION.md`).

## Workflow

1. Leia o `AGENTS.md` do projeto.
2. Se o input for um diretório de feature ou arquivo (`manifest.md`, `spec.md` ou `plan.md`), use-o como fonte: leia os arquivos existentes da feature antes de decidir status.
3. Revise `manifest.md`, `spec.md`, `plan.md` e slices aplicáveis de `ux.md`/`arch.md` (ou confirme `not-applicable` no manifesto): status, blockers, perguntas pendentes, DoD, arquivos alvo, paralelismo, harness e evidência faltante.
4. Não execute se `spec.md` não estiver `ready`, se `plan.md` não tiver task executável, ou se houver decisão pendente que mude escopo/contrato/persistência/harness.
5. Atualize `manifest.md` e `plan.md` antes de delegar: task/fase `running`, owner/subagent, resume point e evidência exigida.
6. Delegue implementação ao papel **worker** (inline ou subagent — ver `references/PI_ADAPTATION.md`), escopo fechado: task, arquivos/responsabilidade, DoD, evidência prática exigida, o slice relevante de `arch.md`/`ux.md`, testes automáticos focados permitidos e regra para não reverter mudanças paralelas.
7. Para cada batch paralelo em `plan.md`, inicie todos os workers independentes antes de aguardar (paralelo quando suportado; senão serialize).
8. Aguarde o batch somente quando os resultados forem necessários para validar, sincronizar ou liberar o próximo batch.
9. Depois de cada worker, delegue validação a papel **validador** separado (inline ou subagent). O validador é guardião da entrega: valida evidência prática e não executa suítes de testes automáticos.
10. Se a validação falhar, registre blocker/falha e delegue correção a worker. Não corrija diretamente.
11. Ao fechar uma fase, delegue a worker o gate final previsto no plano: suíte ampla/final validation quando aplicável, correções mínimas e evidência produzida. Não rode suíte completa a cada task por hábito.
12. Marque task/fase como `done` só quando o validador aprovar evidência prática. Marque a feature como `done` só quando todas as fases estiverem aprovadas e o manifesto apontar evidência suficiente.
13. Ao final, responda ao usuário com um resumo do que foi executado, falhou, ficou pendente e como validar.

## Manager Boundaries

- Pode editar `manifest.md` e `plan.md` para status, blockers, evidência, loop ledger e resume point.
- Pode pedir clarificação ao usuário quando uma decisão bloquear execução segura.
- Não pode implementar código, corrigir testes, alterar arquivos de produto ou declarar validação própria como suficiente.
- Se não houver ferramenta de subagents disponível, siga `references/PI_ADAPTATION.md` (worker e validador inline em passos separados); declare a limitação na resposta final.

## Delegation Prompts

Implementation worker:

```text
Você é o worker responsável por executar somente esta task/fase.
Leia AGENTS.md, spec.md, plan.md e o slice relevante de arch.md/ux.md.
Escopo: {task/fase}
Parallel batch: {batch-id | sequential}
Arquivos/responsabilidade: {write set}
DoD: {DoD}
Evidência prática exigida: {required evidence}
Testes automáticos permitidos: rode apenas testes focados no que esta task altera, salvo exigência explícita do plano.
Não reverta mudanças de outros agentes; adapte-se a edições paralelas.
Implemente o menor diff seguro.
Retorne um delta estruturado (memória compartilhada): files_changed, commands_run (com resultado), evidence_produced (ref observável) e follow_ups/blockers.
Se notar uma receita que já se repetiu (≥2-3 vezes), sinalize como candidato a skill de projeto no follow_ups.
```

Validation worker:

```text
Você é o validador independente desta task/fase.
Leia AGENTS.md, spec.md, plan.md e o resultado do worker.
Não implemente correções.
Não execute testes automáticos; eles pertencem ao worker ou ao gate final de fase.
Valide na prática quando possível via evidência executável/observável: browser, API, consumer, logs, smoke manual, comandos já rodados, outputs e artefatos.
Reprove se houver apenas leitura de código, evidência genérica ou teste sem prova do comportamento afetado.
Verifique alinhamento com requisitos, DoD, arquivos esperados, evidência prática produzida e regressões óbvias.
Responda com aprovado/reprovado, achados concretos, evidência conferida e correção mínima necessária.
```

## Rules

- Toda implementação passa por worker e todo aceite passa por validador separado.
- Quando usar `spawn_agent`, passe contexto mínimo; model pinning é opcional.
- Worker e validador são papéis separados (inline por padrão no Pi); nunca use histórico completo da sessão manager como contexto.
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
- Ação: faça spawn de um worker (convenções de `create-skill` / `skill-creator` do ambiente) que implementa a skill project-local em `{project}/skills/{skill-name}/`, seguido de validador. As próximas tasks chamam a skill em vez de re-derivar.
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
