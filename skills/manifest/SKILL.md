---
name: manifest
description: Orquestra e revisa o workflow completo de feature em `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/`, criando e mantendo `manifest.md`, `spec.md`, `ux.md`, `arch.md` e `plan.md`. Use como `/skill:manifest` quando o usuário pedir o fluxo completo (spec → ux ∥ arch → plan), plano de execução persistido, criação ou revisão de feature, status geral, retomada, long-running work ou paralelismo. Para execução, use `/skill:execute`.
---

# Feature Manifest

Use esta skill como orquestrador de autoria do plugin. Ela coordena `/skill:spec`, `/skill:ux`, `/skill:arch` e `/skill:plan`; execução operacional fica em `/skill:execute`. O entry point externo é `/skill:loop`.

Esta skill só pode editar documentos de workflow da feature. Não edite código de produto, testes, configs, migrations ou arquivos fora da pasta da feature.

Não use achismo: investigue antes de concluir, cite evidência concreta para fatos e registre como blocker/pending qualquer premissa que não puder confirmar por arquivo, comando, log, teste, browser ou resposta do usuário.

Esta skill atua como manager. Execute `/skill:spec` e `/skill:plan` em subagents isolados com `model: gpt-5.5`, `reasoning_effort: xhigh` e `fork_context: false`, passando apenas pedido do usuário, project root, feature dir/arquivo alvo e documentos necessários.

## Workflow

1. Leia o `AGENTS.md` do projeto.
2. Se o input for um diretório de feature ou arquivo (`manifest.md`, `spec.md` ou `plan.md`), use-o como fonte: leia os arquivos existentes da feature antes de decidir status.
3. Identifique o project root e crie ou selecione `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/`.
4. Revise o estado existente: perguntas pendentes, decisões contraditórias, DoD fraco, contrato/persistência/harness ausentes, divergência entre spec/plan/manifest e evidência faltante.
5. Crie ou atualize `manifest.md` com links, status e ponto de retomada.
6. Use `/skill:spec` em subagent isolado para criar ou atualizar `spec.md`.
7. Se o subagent de spec devolver `Status: blocked` com `Clarifications Needed`, apresente as perguntas ao usuário em lote na ordem priorizada, colete as respostas e re-invoque `/skill:spec` no subagent isolado passando feature dir + respostas (`C#`). Repita até `ready` ou bloqueio duro. Não responda por suposição.
8. Depois do subagent de spec, confirme aprovação do guardian da spec; se faltar, dispare guardian ou devolva para a spec corrigir.
9. Com `spec.md` `ready` e guardian aprovado, aplique o **Solution Gate** (ver seção abaixo): confirme `Shared Contract` fechado na spec; decida quais skills de solução rodam; atualize `manifest.md` com `UX`/`Arch` = `not-applicable` ou `pending` antes de spawn.
10. Para cada skill de solução aplicável, use subagent isolado (`ux` e/ou `arch`). Spawn das aplicáveis em paralelo (spawn primeiro, wait depois); ambas partem da spec como contrato âncora. Se a skill devolver `not-applicable`, grave `not-applicable` no `manifest.md` (sem exigir arquivo). Se devolver `Status: blocked` com `Open Questions`, apresente ao usuário, colete respostas (`Q#`) e re-invoque a skill afetada — ou re-invoque `spec` se a dúvida for de produto/contrato. Não responda por suposição.
11. Confirme guardians das skills aplicáveis (`approved`) ou `not-applicable` no manifesto. `missing` após o passo 10 é blocker — não avance.
12. Só use `/skill:plan` em subagent isolado quando: `spec.md` `ready`; cada skill de solução estiver `ready`+guardian `approved` **ou** `not-applicable`+guardian `not-applicable` no manifesto; `Shared Contract` fechado. O plano consome `ux.md`/`arch.md` quando existirem e reconcilia conflitos residuais.
13. Depois do subagent de plan, confirme aprovação do guardian do plan; se faltar, dispare guardian ou devolva para o plan corrigir. Se o plan devolver blocker de produto/contrato, re-invoque `spec` (e `ux`/`arch` se necessário) — não edite `spec.md` inline.
14. Durante execução longa, mantenha `manifest.md` como índice curto e `plan.md` como fonte do progresso detalhado.
15. Antes de marcar `ready`, confirme que spec, ux/arch e plan não deixam contrato, persistência, harness, ponto de retomada ou guardian ambíguos.
16. Ao final, responda ao usuário com um resumo curto do workflow criado/refinado e do que será feito.

## Solution Gate

Precedência (aplique nesta ordem):

1. **`Validation surfaces`** definem o escopo técnico. Mapeamento:
   - `frontend` → `/skill:ux`
   - `backend`, `API`, `job`, `consumer`, `infra` → `/skill:arch`
   - `browser` sem mudança de UI → validação no `plan`/`execute` (harness); não dispara `ux`
   - `browser` com mudança de UI/fluxo → também dispara `ux`
2. **`Intent Classification`** só reduz solução quando **ambos** forem verdadeiros:
   - `User intent: pontual/localizada`
   - `Coverage expectation: somente fluxo afetado`
   - E as surfaces relevantes forem subconjunto mínimo (ex.: um handler, um componente, um endpoint) sem novo contrato compartilhado em `Shared Contract`
3. Se `Intent Classification` e surfaces divergirem, **surfaces vencem** — rode `ux`/`arch` aplicáveis ou reabra a spec.
4. **`Shared Contract`** na spec deve estar `closed` ou `none` antes do spawn de `ux`/`arch`. Se `pending`, re-invoque `spec` — não paralelize solução com contrato compartilhado aberto.

Casos de referência:

| Caso | UX | Arch |
|---|---|---|
| Só frontend | `ux` | `not-applicable` |
| Só backend/infra | `not-applicable` | `arch` |
| Fullstack | `ux` ∥ `arch` | `ux` ∥ `arch` |
| Infra/config pura | `not-applicable` | `arch` |
| Fix pontual (intent + coverage ok, sem shared contract) | `not-applicable` | `not-applicable` → direto ao `plan` |

## `manifest.md` Template

```markdown
# {Feature} Manifest

Status: draft | ready | running | done | fail | blocked
Created: {YYYY-MM-DD HH:MM}
Updated: {YYYY-MM-DD HH:MM}

Spec: ./spec.md
UX: ./ux.md
Arch: ./arch.md
Plan: ./plan.md

## State

- Spec: missing | draft | ready | blocked
- UX: missing | not-applicable | draft | ready | blocked
- Arch: missing | not-applicable | draft | ready | blocked
- Plan: missing | pending | running | done | fail
- Spec Guardian: missing | pending | approved | rejected
- UX Guardian: missing | not-applicable | pending | approved | rejected
- Arch Guardian: missing | not-applicable | pending | approved | rejected
- Plan Guardian: missing | pending | approved | rejected

## Current Resume Point

- Next action: {action}
- Owner/Subagent: {main | subagent-name | unassigned}
- Blockers: {none | blocker}
- Open clarifications: {none | {n} (ver spec.md)}
- Last resume check: {timestamp, command, or none}

## Evidence Index

- {link or command evidence}

## Latest Evidence

- {latest produced evidence or pending}
```

## Rules

- `manifest.md` é índice, não substitui `spec.md` nem `plan.md`.
- Não consolide status, resume point, blockers ou evidência por suposição; confirme nos documentos/comandos ou registre pendência.
- Mesmo se o usuário disser "corrija", "implemente" ou "execute", esta skill deve criar/refinar `manifest.md`, `spec.md`, `ux.md`, `arch.md` e `plan.md` (via subagents) e encaminhar execução para `/skill:execute`; não faça patch de produto.
- Não coloque detalhe técnico extenso no manifesto.
- Quando a spec devolver `Clarifications Needed`, relé as perguntas ao usuário e re-invoque a spec com as respostas; nunca marque `ready` com clarificações abertas nem responda por achismo.
- Se `spec.md` bloquear por decisão de produto, deixe `plan.md` ausente ou marcado como bloqueado.
- Se `plan.md` divergir de `spec.md`, pare e atualize a spec primeiro.
- Ao finalizar, o manifesto deve apontar evidências suficientes para validar o DoD.
- Não marque `ready` quando a próxima execução ainda precisar adivinhar contrato, persistência, harness ou arquivos alvo.
- Aplique o `Solution Gate` com precedência surfaces > intent; registre `not-applicable` no manifesto quando a skill não criar arquivo.
- `not-applicable` no manifesto satisfaz o gate de solução; `missing` após o passo de solução é blocker.
- Não marque `ready` sem guardian aprovado para `spec.md`, `plan.md` e skills aplicáveis (`approved` ou `not-applicable`).
- O que sobrevive à feature (convenção, decisão de arquitetura durável, procedimento repetido) vai pro projeto (`AGENTS.md`, skills project-local, `docs/adr`); o efêmero fica em `.features/{...}/`.
- Ao receber arquivo ou diretório existente, trate a tarefa como revisão: corrija/refine `manifest.md`, `spec.md` e/ou `plan.md` antes de concluir e não aceite status pronto herdado sem checagem.
- Não marque `done` se spec, plan ou manifesto ainda tiver pergunta pendente, blocker, evidência `pending`, guardian rejeitado/pendente ou ponto de retomada indefinido.
- Quando o usuário pedir execução, retomada operacional ou coordenação de workers, encaminhe para `/skill:execute`.

## Checkpoint (obrigatório)

Antes de **cada** `spawn_agent` ou de ceder o turno, grave no `manifest.md`: `Updated:`, status de Spec/UX/Arch/Plan e guardians, resume point e blockers. Não delegue com `manifest.md` desatualizado.

## State & Memory

- Fonte da verdade é o arquivo, não o contexto. Escreva o delta em `manifest.md` (status, resume point) antes de seguir (write-before-forget).
- O contexto guarda só: feature dir, artefato/etapa atual, blockers abertos, próxima ação. O resto é ponteiro (path + resume point) e se re-lê sob demanda.
- Antes de ceder o turno ou compactar: garanta que `manifest.md` reflete o estado real; descarte transcripts de subagent (guarde só {docs produzidos, status, evidência}).
- Compactar = projetar em ponteiro, nunca inventar. Resumo jamais faz upgrade de status. Em divergência, o arquivo vence e re-lê.
- Learnings flush: ao fechar a feature, promova o subconjunto durável (convenções, decisões de arquitetura, procedimentos repetidos) para o projeto; o resto morre com `.features/{...}/`.

## Context Isolation

- O manager não deve executar spec/ux/arch/plan inline quando puder delegar.
- Usar `spawn_agent` com `model: gpt-5.5`, `reasoning_effort: xhigh` e `fork_context: false` para spec, ux, arch, plan e guardians.
- Rodar `ux` e `arch` aplicáveis em paralelo (spawn primeiro, wait depois); passar a cada um só a spec como contrato âncora e os docs necessários.
- Passar contexto mínimo: pedido, paths, `AGENTS.md`, feature dir e docs relevantes.
- Se subagents não estiverem disponíveis, registrar blocker/pending e declarar na resposta final.

## Final Response

Ao concluir, responda com:

- `Resumo`: spec/plan/manifest criados ou refinados e status geral.
- `Será feito`: escopo planejado em linguagem de produto, sem detalhe excessivo.
- `Próxima ação`: execução com `/skill:execute`, clarificação necessária ou `none`.
- `Pendências`: blockers, perguntas abertas ou `none`.
- `Evidência`: arquivos lidos/atualizados e fatos confirmados.
