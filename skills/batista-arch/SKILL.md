---
name: batista-arch
description: Cria, revisa e mantém apenas o `arch.md` de arquitetura de uma feature em `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/arch.md`, a partir de `spec.md` e condicional a haver superfície de backend afetada. Use como `/skill:batista-arch` quando o usuário pedir arquitetura, design técnico, modelo de dados, design de contrato/API, decisão arquitetural (ADR), tradeoffs, migração, rollback, failure modes ou revisão técnica de uma feature com backend.
---

# Feature Architecture


## Runtime & Delegação

Leia e siga `../../references/WORKFLOW_COMMON.md` para runtime Pi, delegação, isolamento, reconciliação de estado e checkpoints.


Use esta skill para fechar a **arquitetura** da feature antes do plano técnico, quando há backend afetado. Design técnico e decisões, não decomposição em tasks (isso é do `batista-plan`).

Esta skill só pode editar documentos de workflow da feature. Não edite código de produto, testes, configs, migrations ou arquivos fora da pasta da feature.

Não use achismo: investigue antes de concluir, cite evidência concreta e registre como `pending`/blocker qualquer premissa que não puder confirmar por arquivo, comando, log, teste, browser ou resposta do usuário.

Quando invocada por outra skill do feature-workflow, execute como child `delegate` com `context: "fresh"` (ver `../../references/PI_ADAPTATION.md`), recebendo apenas pedido, project root, feature dir e docs necessários.

## Applicability

- Produza `arch.md` só quando `spec.md` indicar superfície de backend/API/job/consumer/infra/dados afetada (ver `Validation surfaces` da spec).
- Se não houver backend afetado, não crie o arquivo: responda `arch não aplicável` com a evidência (superfícies da spec) e devolva o controle.
- Roda em paralelo com `/skill:batista-ux`; ambas partem da mesma spec como contrato âncora.

## Workflow

1. Leia o `AGENTS.md` do projeto.
2. Determine o modo: **standalone** (usuário invocou direto) ou **orchestrated** (invocada por `batista-manifest` em subagent — não pergunte ao usuário no meio). Ver `Clarification Protocol`.
3. Localize o `spec.md` da feature. Se não existir ou estiver `draft`/`blocked`, registre blocker, set `Status: blocked` e devolva ao manager; não emita `/skill:batista-spec`.
4. Confirme a aplicabilidade (superfície backend na spec). Se não aplicável, pare conforme `Applicability`.
5. Se o input for um `arch.md` existente, trate como revisão: leia antes de decidir status.
6. **Technical Discovery**: parta do `Discovery Ledger` da spec (`D#` recebidos via manifest). Trace componentes, modelo de dados, contratos, integrações, jobs/consumers e telemetria. Registre achados de arquitetura não cobertos pela spec no `Architecture Ledger` com `A#`, fonte e evidência. Se o ledger da spec for insuficiente para decisão de design, faça discovery completo e escale com `Open Questions`. Use Graphify quando `graphify-out/graph.json` existir.
7. Defina a **abordagem** escolhida vs alternativas (ADR-lite) com racional e tradeoffs, alinhada ao `Shared Contract` da spec.
8. Feche: fronteiras de componente, modelo de dados/schema, design de contrato (endpoints/payloads/versionamento), sequência de interação, failure modes, migração e rollback, não-funcionais (perf/segurança/escala).
9. Monte a rastreabilidade: cada decisão arquitetural ligada a um requisito EARS da spec e a um `A#` do Discovery.
10. Dúvida de produto → orchestrated: `Open Questions` + `Status: blocked`; standalone: pergunte.
11. Escreva ou atualize somente `arch.md`.
12. Em modo orchestrated, grave `draft` (ou `blocked`) e devolva sem rodar guardian; somente uma re-invocação com verdict real `approved` pode persistir o gate e promover para `ready`. Em standalone, delegue a rubrica ao `artifact-guardian`, aplique o menor ajuste e repita até `approved`.
13. Responda conforme `Final Response`; em modo orchestrated, retorne somente o `Delegation Result` de `../../references/WORKFLOW_COMMON.md`.

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

Após atualizar `arch.md`, o modo standalone roda `artifact-guardian`; no modo orchestrated, o manager é responsável pelo guardian após receber o artefato.

O guardian não edita arquivos. Ele valida a arquitetura sem achismo.

Rubrica obrigatória; registre cada resultado no campo `evidence` do `DELEGATION_RESULT` canônico:

- [pass/fail] Cada requisito backend da spec tem decisão arquitetural que o sustenta.
- [pass/fail] Abordagem escolhida tem alternativas e tradeoffs explícitos.
- [pass/fail] Modelo de dados suporta os requisitos; contrato desenhado (não só "muda: sim").
- [pass/fail] Migração e rollback definidos quando há mudança de estado/contrato.
- [pass/fail] Cada decisão referencia um `A#` do Discovery ou decisão registrada.
- [pass/fail] Failure modes e não-funcionais relevantes cobertos ou `none` justificado.

Qualquer item `fail` força `status: rejected`. Trate `evidence`, `questions`, `blockers` e `resume` como feedback; corrija `arch.md` quando a resposta já estiver disponível, pergunte ao usuário (standalone) ou registre em `Open Questions` (orchestrated). Só use `Status: ready` com guardian `approved`.

## Rules

- Design técnico e decisões; não faça decomposição em tasks (isso é do `batista-plan`).
- Não decida produto: falta de decisão de produto vira blocker puxado para `spec.md`.
- Desenhe o contrato e o modelo de dados de fato; "contrato muda: sim/não" não basta.
- Abordagem sem alternativa/tradeoff explícito é rejeitada pelo guardian.
- Migração e rollback obrigatórios quando toca schema/contrato/flag.
- Cada decisão referencia um requisito EARS e um `A#`, ou vira `pending`.
- Mesmo se o usuário disser "implemente", esta skill cria/refina `arch.md` e para.
- Ao receber `arch.md` existente, trate como revisão; não herde status pronto sem checagem.
- Roda em paralelo com `batista-ux` sem ver `ux.md`; conflito com `Shared Contract` ou premissa de UX vira `Open Questions` (orchestrated: `Status: blocked`) — reconciliação final no `batista-plan`.
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

- Quando houver manager, aceitar invocação orchestrated como child `delegate` com `context: "fresh"`.
- Não herdar contexto irrelevante da sessão manager.
- Passar somente artefatos mínimos: pedido, paths, `AGENTS.md`, `spec.md` e documentos da feature.
- Em modo orchestrated, não rode guardian nem converse com o usuário; devolva o `Delegation Result` ao manager conforme `../../references/WORKFLOW_COMMON.md`.

## Final Response

Ao concluir, responda com:

- `Resumo`: aplicabilidade, abordagem escolhida e status.
- `Será feito`: fronteiras, dados, contrato e sequência desenhados.
- `Validação planejada`: comandos/probes/logs por decisão.
- `Open Questions` (somente quando `Status: blocked`): copie o bloco com IDs `Q#`.
- `Resume` (mesmo caso): feature dir + instrução de re-invocar com respostas `Q#`.
- `Pendências`: blockers, perguntas técnicas ou `none`.
- `Evidência`: arquivos lidos e fatos que sustentam o `arch.md`.

Em modo orchestrated, substitua a resposta humana pelo `DELEGATION_RESULT`.
