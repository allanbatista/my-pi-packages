---
name: arch
description: Cria, revisa e mantém apenas o `arch.md` de arquitetura de uma feature em `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/arch.md`, a partir de `spec.md` e condicional a haver superfície de backend afetada. Use como `/skill:arch` quando o usuário pedir arquitetura, design técnico, modelo de dados, design de contrato/API, decisão arquitetural (ADR), tradeoffs, migração, rollback, failure modes ou revisão técnica de uma feature com backend.
---

# Feature Architecture


## Pi Runtime

No Pi, a delegação padrão é **inline** com isolamento de contexto (ver `references/PI_ADAPTATION.md`). Use `spawn_agent`/`fork_context` apenas quando o runtime oferecer paridade Codex. Invoque skills filhas via `/skill:<name>`. Não bloqueie o workflow por indisponibilidade de subagent.
## Delegação

Siga `references/PI_ADAPTATION.md` e `references/MODEL_POLICY.md`:
- **Padrão Pi**: execução inline na sessão atual, contexto mínimo (pedido, paths, `AGENTS.md`, docs da feature).
- **Modelo (planejamento)**: herde **modelo e effort da sessão principal** — sem override de modelo/thinking.
- **Subagent opcional**: `planner`, `oracle` ou `delegate` sem `agentOverrides`; guardians de artefato **não** usam `reviewer` (reservado à validação de execução).
- **Guardian**: passo separado (inline ou subagent) que aplica rubrica sem editar arquivos.
- **Paralelo**: batch paralelo quando suportado; senão serialize com write sets verificados.


Use esta skill para fechar a **arquitetura** da feature antes do plano técnico, quando há backend afetado. Design técnico e decisões, não decomposição em tasks (isso é do `plan`).

Esta skill só pode editar documentos de workflow da feature. Não edite código de produto, testes, configs, migrations ou arquivos fora da pasta da feature.

Não use achismo: investigue antes de concluir, cite evidência concreta e registre como `pending`/blocker qualquer premissa que não puder confirmar por arquivo, comando, log, teste, browser ou resposta do usuário.

Quando invocada por outra skill do feature-workflow, execute com isolamento de contexto (inline por padrão no Pi; subagent opcional — ver `references/PI_ADAPTATION.md`), recebendo apenas pedido, project root, feature dir e docs necessários.

## Applicability

- Produza `arch.md` só quando `spec.md` indicar superfície de backend/API/job/consumer/infra/dados afetada (ver `Validation surfaces` da spec).
- Se não houver backend afetado, não crie o arquivo: responda `arch não aplicável` com a evidência (superfícies da spec) e devolva o controle.
- Roda em paralelo com `/skill:ux`; ambas partem da mesma spec como contrato âncora.

## Workflow

1. Leia o `AGENTS.md` do projeto.
2. Determine o modo: **standalone** (usuário invocou direto) ou **orchestrated** (invocada por `manifest` em subagent — não pergunte ao usuário no meio). Ver `Clarification Protocol`.
3. Localize o `spec.md` da feature. Se não existir, use `/skill:spec` primeiro. Se estiver `draft`/`blocked`, registre blocker, set `Status: blocked` e devolva ao manager.
4. Confirme a aplicabilidade (superfície backend na spec). Se não aplicável, pare conforme `Applicability`.
5. Se o input for um `arch.md` existente, trate como revisão: leia antes de decidir status.
6. **Technical Discovery**: trace a arquitetura atual ponta a ponta — componentes, modelo de dados, contratos, integrações, jobs/consumers, telemetria. Registre cada achado no `Architecture Ledger` com `A#`, fonte e evidência. Use Graphify quando `graphify-out/graph.json` existir.
7. Defina a **abordagem** escolhida vs alternativas (ADR-lite) com racional e tradeoffs, alinhada ao `Shared Contract` da spec.
8. Feche: fronteiras de componente, modelo de dados/schema, design de contrato (endpoints/payloads/versionamento), sequência de interação, failure modes, migração e rollback, não-funcionais (perf/segurança/escala).
9. Monte a rastreabilidade: cada decisão arquitetural ligada a um requisito EARS da spec e a um `A#` do Discovery.
10. Dúvida de produto → orchestrated: `Open Questions` + `Status: blocked`; standalone: pergunte.
11. Escreva ou atualize somente `arch.md`.
12. Rode guardian independente (inline ou subagent); aplique o menor ajuste e repita até `approved`.
13. Responda conforme `Final Response` (inclua `Open Questions` + `Resume` quando `blocked` em orchestrated).

## Template

```markdown
# {Feature} — Architecture

Status: draft | ready | blocked
Spec: ./spec.md
Created: {YYYY-MM-DD HH:MM}
Updated: {YYYY-MM-DD HH:MM}

## Applicability

- Backend afetado: {sim | não} — evidência: {superfícies da spec}

## Architecture Ledger

| ID | Source | Finding | Evidence | Impact | Status |
|---|---|---|---|---|---|
| A1 | {componente/schema/contrato/integração/doc} | {fato ou lacuna técnica} | {path, trecho, comando, log} | {como muda o design} | confirmed/pending |

## Approach (ADR-lite)

- Escolhida: {abordagem}
- Alternativas: {A) ... | B) ...}
- Racional: {por que a escolhida}
- Tradeoffs: {custo aceito}

## Component Boundaries

- {componentes afetados/novos e suas responsabilidades/limites}

## Data Model

- {entidades, mudanças de schema, índices, invariantes, ou none}

## Contract Design

- {endpoints/eventos, payloads, versionamento, compatibilidade, ou none}

## Interaction / Sequence

- {sequência das interações entre componentes para o fluxo alvo}

## Failure Modes & Rollback

- Failure modes: {o que pode falhar e o efeito}
- Migração: {ordem, backfill, ou none}
- Rollback: {git revert | passo específico se toca migration/contrato/flag}

## Non-Functional

- {perf, segurança, escala, limites relevantes ou none}

## Architecture Traceability

| Requisito (EARS back) | Decisão arquitetural | Contrato/dado afetado | Validação | Basis | Status |
|---|---|---|---|---|---|
| {req da spec} | {decisão} | {contrato/schema} | {comando/probe/log/teste} | {A# ou decisão} | defined/pending |

## Open Questions

- {none | pergunta técnica que bloqueia ready}

## Readiness Gates

- [ ] `AGENTS.md` e `spec.md` lidos.
- [ ] Abordagem escolhida com alternativas e tradeoffs.
- [ ] Modelo de dados e design de contrato fechados ou `none` justificado.
- [ ] Migração e rollback definidos quando há mudança de estado/contrato.
- [ ] Cada requisito backend tem decisão arquitetural rastreável (`A#`).
- [ ] Guardian aprovou o `arch.md`.

## Definition of Done

- [ ] Arquitetura sustenta todo requisito backend com rastreabilidade.
- [ ] Contrato e persistência desenhados, não só citados.
- [ ] Migração/rollback e failure modes definidos.
- [ ] Guardian aprovou.
```

## Artifact Guardian

Após atualizar `arch.md`, rode guardian independente (inline ou subagent) com contexto mínimo: pedido do usuário, project root, `AGENTS.md`, feature dir, `spec.md`, `arch.md` e evidências citadas.

O guardian não edita arquivos. Ele valida a arquitetura sem achismo.

Saída obrigatória do guardian:

```markdown
Status: approved | rejected
Rubric:
- [pass/fail] Cada requisito backend da spec tem decisão arquitetural que o sustenta.
- [pass/fail] Abordagem escolhida tem alternativas e tradeoffs explícitos.
- [pass/fail] Modelo de dados suporta os requisitos; contrato desenhado (não só "muda: sim").
- [pass/fail] Migração e rollback definidos quando há mudança de estado/contrato.
- [pass/fail] Cada decisão referencia um `A#` do Discovery ou decisão registrada.
- [pass/fail] Failure modes e não-funcionais relevantes cobertos ou `none` justificado.
Questions: none | {perguntas que bloqueiam ready}
Critiques: none | {críticas que bloqueiam ready}
Required changes: none | {ajustes obrigatórios}
```

Qualquer item `fail` na rubrica força `Status: rejected`. Trate `Rubric`, `Questions`, `Critiques` e `Required changes` como blocker; corrija `arch.md` quando a resposta já estiver disponível, pergunte ao usuário (standalone) ou registre em `Open Questions` (orchestrated). Só use `Status: ready` com guardian `approved`.

## Rules

- Design técnico e decisões; não faça decomposição em tasks (isso é do `plan`).
- Não decida produto: falta de decisão de produto vira blocker puxado para `spec.md`.
- Desenhe o contrato e o modelo de dados de fato; "contrato muda: sim/não" não basta.
- Abordagem sem alternativa/tradeoff explícito é rejeitada pelo guardian.
- Migração e rollback obrigatórios quando toca schema/contrato/flag.
- Cada decisão referencia um requisito EARS e um `A#`, ou vira `pending`.
- Mesmo se o usuário disser "implemente", esta skill cria/refina `arch.md` e para.
- Ao receber `arch.md` existente, trate como revisão; não herde status pronto sem checagem.
- Roda em paralelo com `ux` sem ver `ux.md`; conflito com `Shared Contract` ou premissa de UX vira `Open Questions` (orchestrated: `Status: blocked`) — reconciliação final no `plan`.
- Não aceite guardian genérico; ele lista evidência conferida ou bloqueia com pergunta/crítica objetiva.

## Clarification Protocol

- Standalone: pergunte ao usuário em lote, registre em `Open Questions` resolvidas e continue.
- Orchestrated: não pergunte no meio. Preencha `Open Questions` com IDs `Q#`, set `Status: blocked`, grave `arch.md` e devolva ao manager com bloco copiado na resposta final.

## Checkpoint (obrigatório)

Antes de **cada** guardian ou de ceder o turno, grave no `arch.md`: `Updated:`, `Status`, `Open Questions` e blockers.

## State & Memory

- Fonte da verdade é o arquivo, não o contexto. Escreva o delta no `arch.md` antes de seguir (write-before-forget).
- O contexto guarda só: feature dir, decisão/contrato atual, blockers abertos, próxima ação. O resto é ponteiro e se re-lê sob demanda.
- Compactar = projetar em ponteiro, nunca inventar. Resumo jamais faz upgrade de status. Em divergência, o arquivo vence.
- Decisão de arquitetura que sobrevive à feature vai pro projeto (`AGENTS.md`/`docs/adr`); o efêmero fica em `.features/{...}/`.

## Context Isolation

- Quando houver manager, aceitar invocação orchestrated com contexto mínimo (inline por padrão no Pi).
- Não herdar contexto irrelevante da sessão manager.
- Passar somente artefatos mínimos: pedido, paths, `AGENTS.md`, `spec.md` e documentos da feature.
- Se subagents não estiverem disponíveis, siga `references/PI_ADAPTATION.md` (execução inline com isolamento de contexto); declare a limitação na resposta final e não use contexto oculto como evidência.

## Final Response

Ao concluir, responda com:

- `Resumo`: aplicabilidade, abordagem escolhida e status.
- `Será feito`: fronteiras, dados, contrato e sequência desenhados.
- `Validação planejada`: comandos/probes/logs por decisão.
- `Open Questions` (somente quando `Status: blocked`): copie o bloco com IDs `Q#`.
- `Resume` (mesmo caso): feature dir + instrução de re-invocar com respostas `Q#`.
- `Pendências`: blockers, perguntas técnicas ou `none`.
- `Evidência`: arquivos lidos e fatos que sustentam o `arch.md`.
