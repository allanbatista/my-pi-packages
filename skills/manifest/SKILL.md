---
name: manifest
description: Orquestra e revisa o workflow completo de feature em `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/`, criando e mantendo `manifest.md`, `spec.md`, `ux.md`, `arch.md` e `plan.md`. Use como `/skill:manifest` quando o usuário pedir o fluxo completo (spec → ux ∥ arch → plan), plano de execução persistido, criação ou revisão de feature, status geral, retomada, long-running work ou paralelismo. Para execução, use `/skill:execute`.
---

# Feature Manifest


## Runtime & Delegação

Leia e siga `../../references/WORKFLOW_COMMON.md` para runtime Pi, delegação, isolamento, reconciliação de estado e checkpoints.


Use esta skill como orquestrador de autoria do plugin. Ela coordena as skills `spec`, `ux`, `arch` e `plan` via subagents; execução operacional fica na rotina `execute`. O entry point externo é `/skill:loop`.

Esta skill só pode editar documentos de workflow da feature. Não edite código de produto, testes, configs, migrations ou arquivos fora da pasta da feature.

Não use achismo: investigue antes de concluir, cite evidência concreta para fatos e registre como blocker/pending qualquer premissa que não puder confirmar por arquivo, comando, log, teste, browser ou resposta do usuário.

Esta skill atua como manager raiz. Delegue `spec`, `ux`, `arch` e `plan` pela ferramenta `subagent`, nunca emitindo `/skill:*`; veja `../../references/PI_ADAPTATION.md`.

## Workflow

1. Leia o `AGENTS.md`, valide paths e aplique o preflight `list` + `get` de `../../references/WORKFLOW_COMMON.md` para `delegate` e `artifact-guardian`.
2. Se o input resolver para feature dir ou arquivo existente, selecione-o e releia seus artefatos; não crie outra feature. Para pedido novo, crie `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/`.
3. Reconcile status, perguntas, gates, guardians e evidência conforme `State Reconciliation`; o arquivo mais específico vence o manifesto.
4. Crie ou atualize `manifest.md` com links, estado real e resume point.
5. Despache a partir do primeiro artefato ausente, bloqueado, inválido ou indicado no resume point; não reinicie pela spec quando ela já estiver realmente `ready` e aprovada.
6. Para `spec`, aplique `Author → Guardian Handshake`. Se retornar `blocked`, persista as `Clarifications Needed`, apresente-as ao usuário e ceda o turno; não responda por suposição.
7. Com spec válida, aplique o **Solution Gate**: confirme `Shared Contract` fechado e grave UX/Arch como `not-applicable` ou `draft` antes da delegação.
8. Para cada solução aplicável, aplique `Author → Guardian Handshake`; `ux` e `arch` podem compartilhar uma chamada paralela quando os write sets forem disjuntos. Passe o `Discovery Ledger` (`D#`) da spec. Pergunta de produto/contrato volta à spec.
9. Só planeje quando spec e soluções aplicáveis estiverem `ready`+guardian `approved`, soluções não aplicáveis estiverem explicitamente `not-applicable` e o contrato compartilhado estiver fechado.
10. Para `plan`, aplique `Author → Guardian Handshake`. Blocker de produto/contrato reabre a menor skill fonte; o manager não edita o artefato folha.
11. Releia todos os artefatos e marque manifest `ready` somente com estados, gates e guardians persistidos e zero pergunta material.
12. Se esta rotina foi carregada pelo `loop`, não emita `Final Response`: devolva o controle ao passo seguinte do loop no mesmo turno. Em invocação standalone, responda conforme `Final Response`.

### Resume Dispatch

| Estado real | Próxima ação |
|---|---|
| Spec ausente/draft/blocked/rejected | `spec` |
| Spec pronta; UX/Arch aplicável incompleto | `ux`/`arch` |
| Soluções prontas; plan incompleto | `plan` |
| Pergunta material aberta | manifest `blocked`; perguntar ao usuário |
| Tudo pronto e aprovado | manifest `ready`; retornar ao `loop` |

### Author → Guardian Handshake

1. Resolva o `SKILL.md` exato desta instalação e delegue a folha com `delegate`, `model: "inherit"`, `context: "fresh"`, `cwd` explícito e o prompt de `../../references/WORKFLOW_COMMON.md`; não selecione skill apenas pelo nome.
2. Releia o artefato. Se houver pergunta material, persista `blocked` no manifesto e não rode guardian.
3. Sem perguntas e com gates internos completos — exceto o gate autorreferente de aprovação — delegue a rubrica ao `artifact-guardian`; ele não edita arquivos.
4. Se rejeitado, incremente o iteration budget, re-invoque o autor com o feedback ou bloqueie quando faltar decisão/evidência.
5. Se aprovado, re-invoque o autor somente para persistir a aprovação, marcar o gate do guardian e promover o artefato a `ready`; então releia o arquivo antes de atualizar o manifesto.

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
Iteration budget: 3
Iterations used: {0}

## State

- Spec: missing | draft | ready | blocked
- UX: missing | not-applicable | draft | ready | blocked
- Arch: missing | not-applicable | draft | ready | blocked
- Plan: missing | draft | ready | blocked | running | done | fail
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
- Mesmo se o usuário disser "corrija", "implemente" ou "execute", esta rotina deve criar/refinar os artefatos via subagents e retornar ao `loop`; apenas a invocação standalone indica `/skill:execute` ao usuário. Não faça patch de produto.
- Não coloque detalhe técnico extenso no manifesto.
- Quando a spec devolver `Clarifications Needed`, relé as perguntas ao usuário e re-invoque a spec com as respostas; nunca marque `ready` com clarificações abertas nem responda por achismo.
- Se `spec.md` bloquear por decisão de produto, deixe `plan.md` ausente ou marcado como bloqueado.
- Se `plan.md` divergir de `spec.md`, pare e atualize a spec primeiro.
- Ao finalizar, o manifesto deve apontar evidências suficientes para validar o DoD.
- Não marque `ready` quando a próxima execução ainda precisar adivinhar contrato, persistência, harness ou arquivos alvo.
- Aplique o `Solution Gate` com precedência surfaces > intent; registre `not-applicable` no manifesto quando a skill não criar arquivo.
- `not-applicable` no manifesto satisfaz o gate de solução; `missing` após o passo de solução é blocker.
- Guardians de spec, ux/arch aplicáveis e plan são sempre obrigatórios e independentes.
- **Iteration budget**: incremente `Iterations used` em toda rejeição ou reinvocação de autor; com 3 tentativas sem evidência nova, force `Status: blocked` e reporte.
- Mudança em spec invalida UX/Arch/Plan e seus guardians; mudança em UX/Arch invalida Plan e seu guardian; mudança no plan invalida seu guardian. Persista os resets antes do próximo dispatch.
- O que sobrevive à feature (convenção, decisão de arquitetura durável, procedimento repetido) vai pro projeto (`AGENTS.md`, skills project-local, `docs/adr`); o efêmero fica em `.features/{...}/`.
- Ao receber arquivo ou diretório existente, trate a tarefa como revisão: corrija/refine `manifest.md`, `spec.md` e/ou `plan.md` antes de concluir e não aceite status pronto herdado sem checagem.
- Não marque `done` se spec, plan ou manifesto ainda tiver pergunta pendente, blocker, evidência `pending`, guardian rejeitado/pendente ou ponto de retomada indefinido.
- Quando o usuário pedir execução, retomada operacional ou coordenação de workers, encaminhe para `/skill:execute`.

## Checkpoint (obrigatório)

Antes de **cada** chamada `subagent` ou de ceder o turno, grave no `manifest.md`: `Updated:`, status de Spec/UX/Arch/Plan e guardians, resume point e blockers. Não delegue com `manifest.md` desatualizado.

## State & Memory

- Fonte da verdade é o arquivo, não o contexto. Escreva o delta em `manifest.md` (status, resume point) antes de seguir (write-before-forget).
- O contexto guarda só: feature dir, artefato/etapa atual, blockers abertos, próxima ação. O resto é ponteiro (path + resume point) e se re-lê sob demanda.
- Antes de ceder o turno ou compactar: garanta que `manifest.md` reflete o estado real; descarte transcripts de subagent (guarde só {docs produzidos, status, evidência}).
- Compactar = projetar em ponteiro, nunca inventar. Resumo jamais faz upgrade de status. Em divergência, o arquivo vence e re-lê.
- Learnings flush: ao fechar a feature, promova o subconjunto durável (convenções, decisões de arquitetura, procedimentos repetidos) para o projeto; o resto morre com `.features/{...}/`.

## Context Isolation

- O manager não deve executar spec/ux/arch/plan inline quando puder delegar.
- Delegar spec, ux, arch, plan e guardians pela ferramenta `subagent`, sempre com `context: "fresh"` e `cwd` explícito (ver `../../references/PI_ADAPTATION.md`).
- Rodar `ux` e `arch` aplicáveis em paralelo quando suportado; senão serialize; passar só spec como contrato âncora e docs necessários.
- Passar contexto mínimo: pedido, paths, `AGENTS.md`, feature dir e docs relevantes.
- Se `subagent` não estiver disponível, siga `../../references/PI_ADAPTATION.md`: grave blocker e não simule guardian ou autoria inline.

## Final Response

Ao concluir, responda com:

- `Resumo`: spec/plan/manifest criados ou refinados e status geral.
- `Será feito`: escopo planejado em linguagem de produto, sem detalhe excessivo.
- `Próxima ação`: em standalone, execução com `/skill:execute`; quando carregada pelo loop, retorno ao controlador; ou clarificação necessária.
- `Pendências`: blockers, perguntas abertas ou `none`.
- `Evidência`: arquivos lidos/atualizados e fatos confirmados.
