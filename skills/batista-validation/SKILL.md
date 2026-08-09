---
name: batista-validation
description: Elaborates the `validation.md` of a feature in `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/validation.md`, formulating the `Validation Plan` before any validation is performed and tracking `Validation Progress` item by item. Use `/skill:batista-validation` when the user asks for a validation plan, what needs to be validated/tested, validation progress, evidence, or review of an existing `validation.md`.
---

# Feature Validation

## Runtime & Delegation

Read and follow `../../references/WORKFLOW_COMMON.md` for Pi runtime, delegation, isolation, state reconciliation and checkpoints.

Scope: the feature's `validation.md` workflow doc only — never product code, tests, configs, migrations or any file outside the feature folder.

No guessing: investigate before concluding, cite concrete evidence, register as blocker any premise unconfirmable via file, command, log, test, browser or user answer.

Invoked by another feature-workflow skill? Run as child `delegate`, contexto mínimo (fresh) (see `../../references/PI_ADAPTATION.md`), receiving only request, project root, feature dir and needed docs (`spec.md`/`plan.md`). Orquestrado: escreve somente `validation.md` da feature e retorna apenas `DELEGATION_RESULT`; nunca simula worker/validator inline nem usa mecanismo de chamada entre skills, nunca conversa com o usuário.

## Workflow

1. Read project `AGENTS.md`.
2. Determine mode: **standalone** (direct invocation) or **orchestrated** (child de `batista-manifest`). If input is a feature dir or file, read existing artifacts before deciding status.
3. The `validation.md` is only authored **after** `spec.md` **and** `plan.md` are `ready` with their guardians `approved`. If either is `draft`, `blocked`, `running` or `done`/`fail` without an approved guardian, register blocker and return to the manager; do not formulate a plan against an unapproved spec/plan.
4. Read `spec.md` (requirements `R#` and acceptance criteria Given/When/Then) and `plan.md` (Impact Map, phases, tasks, DoD, `Validation Harness`, required evidence). These are the sources of every validation item.
5. Review existing state: review `validation.md` when it exists — check `Status`, `Validation Plan` completeness, `Validation Progress` statuses/evidence, and guardian gate. Never accept an inherited `ready`/`done` status unchecked.
6. **Formulate the `Validation Plan` BEFORE any validation is performed.** No validation evidence may be produced before the plan exists. Every item `V#` derives from an Impact Map row or a plan task, linking to the spec requirement/acceptance criterion it validates.
7. Each item `V#` must carry: description; bound requirement/acceptance criterion (`R#`); concrete method/commands; expected evidence (observable output + exit code); and the phase/task that produces the evidence.
8. Write the `Validation Progress` with one record per item (`V#`), all starting `pending`, with the execution manager (not this skill) later updating status (`pending|pass|fail`) and produced evidence, and the `workflow-validator` conferring each item before promotion.
9. For punctual fixes (fix puntual): keep the `Validation Plan` lean — 3–5 items — but it remains mandatory.
10. If contract, sources (`spec.md`/`plan.md`), Impact Map or target files are ambiguous, register blocker in `validation.md` with `Escalation: spec | plan | manifest` and return to the manager; never create a validation plan by guessing.
11. Create/update only `validation.md`.
12. Orchestrated: record `draft` (or `blocked`) and return without guardian; only a re-invocation with real verdict `approved` persists the gate and promotes to `ready`. Standalone: delegate the rubrica to `artifact-guardian`.
13. Standalone: if guardian rejects, apply the smallest needed fix in `validation.md` or register blocker and re-validate. Never conclude with guardian pending or rejected.
14. Update `Updated:` before and after each status/evidence change.
15. Orchestrated: return only the `DELEGATION_RESULT` (see `../../references/WORKFLOW_COMMON.md`); else respond per `Final Response`.

## Template

```markdown
# {Feature} — Plano e Progresso de Validação

Status: draft | ready | running | done | fail | blocked
Spec: ./spec.md
Plan: ./plan.md
Updated: {YYYY-MM-DD HH:MM}

> `Validation Plan` formulado **antes** de qualquer validação; `Validation Progress` item a item.
> Nenhuma validação foi executada até a data/hora acima; todos os itens estão `pending`.

## Validation Plan

Itens `V#` derivados do Impact Map e das tasks do `plan.md`, cobrindo **todas** as alterações da feature. Cada item vincula requisito/acceptance criterion da spec (R#), método/comandos concretos, evidência esperada (saída observável + exit code) e a fase/task que produz a evidência.

### V1 — {Nome do item}

- **Descrição:** {o que é validado e por que}
- **Requisito/AC:** {R#} ({AC Given/When/Then quando aplicável})
- **Método/comandos:**
  - `{comando concreto}`
  - `{comando concreto}`
- **Evidência esperada:** {saída observável + exit code esperado}
- **Fase/task produtora:** {Phase/task do plan.md}

## Validation Progress

Um registro por item `V#`. O **manager de execução** (`batista-execute`) atualiza `Status`/`Evidência produzida` a partir de relatórios do worker e veredictos do `workflow-validator`; o **`workflow-validator`** confere cada item (status + evidência) com aprovação positiva explícita antes de qualquer `pass`.

| Item | Status | Evidência produzida | Conferido pelo workflow-validator |
|---|---|---|---|
| V1 — {Nome} | pending | pending | pendente |

## Regras de Promoção e Invalidação

- **Promoção:** um item só vira `pass` com evidência prática registrada (saída observável + exit code) e conferência positiva item a item do `workflow-validator`.
- **Bloqueio:** itens `pending`/`fail` bloqueiam `converged` (Root Completion Gate do loop) e merge; item `fail` dispara correção via worker e revalidação.
- **Cascata (C2/D6):** mudança substantiva em `spec.md` ou `plan.md` rebaixa este documento para `draft` e o guardian para `pending`, e **todos** os itens `pass` anteriores voltam a `pending` (evidência antiga deixa de contar; aprovação vale só para a revisão lida) até revalidação.
- **Atualização:** a cada mudança de status/evidência, atualiza `Updated:` no cabeçalho e reflete no `Validation Progress`.
- **Limite de escrita:** este arquivo é editado somente pelo manager de execução/loop (allowlist); nunca entra em write set de workers paralelos (arquivo único compartilhado).
```

## Artifact Guardian

Standalone runs `artifact-guardian` after updating `validation.md`; orchestrated leaves the guardian to the manager after receiving the artifact.

Guardian never edits files. It validates adherence to spec (requirements/acceptance) and plan (Impact Map, tasks, DoD, harness) and the completeness of `Validation Plan`/`Validation Progress` without guessing.

Mandatory rubric — concrete harness, no generic placeholders; record each result in the `evidence` field of the canonical `DELEGATION_RESULT`:

- [pass/fail] `Validation Plan` is formulated for **all** changes covered by the Impact Map/tasks; every item `V#` links a requirement/acceptance criterion (`R#`).
- [pass/fail] Each item `V#` cites concrete method/commands and expected evidence (observable output + exit code), not generic placeholders.
- [pass/fail] `Validation Progress` has one record per item `V#`, each `pending` (or correctly `pass`/`fail` with produced evidence conferido pelo `workflow-validator`).
- [pass/fail] All changes are covered by at least one item — nothing changed goes unvalidated.
- [pass/fail] `Status`/`Updated:` consistent; guardian gate recorded; no `pass` promoted without an explicit positive `workflow-validator` verdict.

Any `fail` forces `status: rejected`. Copy `evidence`, `questions`, `blockers` and `resume` to `Guardian Review`; fix `validation.md` when the answer is available or register blocker with `Escalation` when decision/evidence is missing. Use `Status: ready`/`done` only with guardian `approved`.

## Rules

- Allowed statuses: `draft`, `ready`, `running`, `done`, `fail`, `blocked`.
- Mandatory for every feature, including punctual fix (fix puntual — enxuto, 3–5 itens). Sempre.
- Never validate before the `Validation Plan` exists; never formulate a plan against an unapproved `spec.md`/`plan.md`.
- Every item `V#` must reference a mapped surface/task; item without method/commands or expected evidence becomes blocker/pending.
- All changes must be covered by an item — evidência que cobre todas as alterações.
- Invalidation em cascata: mudança substantiva em `spec.md`/`plan.md` → `validation.md` `draft` + guardian `pending` + itens `pass` → `pending`.
- Aprovação vale só para a revisão lida; cada revalidação reflete-se em `Updated:`.
- This skill writes only `validation.md` (and `Updated:`/status); execution updates produtoras e conferência são do manager/`workflow-validator`, não desta skill.
- Orquestrado (child delegate): contexto mínimo, retorna apenas `DELEGATION_RESULT`; sem conversa com o usuário; sem mecanismo de chamada entre skills (slash commands nunca invocam outra skill).
- Never mark `done` if any item is `pending`/`fail`, evidence missing, guardian pending/rejected, or plan/spec changed substantively.
- On receiving an existing `validation.md`, treat as review: fix/refine before concluding; never accept inherited ready status unchecked.
- No full suites per item: evidência focada por item; suíte ampla no gate final do plan.
- Done requires practical working evidence, not diff reading or code review.
- No guessing: review the repo and spec/plan before writing; register blocker when a premise is unconfirmable.

## Skill Extraction

Repetitive validation recipes become project skills, not boilerplate copied into `validation.md`.

- Trigger: the same recipe (sequence of commands/validation) appears in ≥ 2–3 items or previous features. Record the candidate as a note in `validation.md`.
- Action: plan an extraction task delegating to a subagent (project-skill conventions) implementing in `{project}/skills/{skill-name}/`, with validation guardian. Subsequent features call the skill instead of re-deriving.
- Runs **only** on the main worktree, after merging parallel features, one at a time. Exclusive write set: `{project}/skills/{skill-name}/`.
- Guardrail (YAGNI): one-off does not become a skill. Extract only with real repetition and a stable procedure.

## Checkpoint (mandatory)

Before any guardian, parallel batch or turn handoff, record in `validation.md`: `Updated:`, resume point, statuses, blockers, latest evidence. Never trigger a guardian with a stale `validation.md`.

## State & Memory

- File is the source of truth, not context. Write the delta to `validation.md` (status, progress, evidence, updated) before proceeding (write-before-forget).
- Context holds only: feature dir, current item, open blockers, next action. Everything else is a pointer (path + resume point) re-read on demand.
- Before handing off/compacting: ensure real resume point/status in file. Compact = project into pointers, never invent. A summary never upgrades status. On divergence, the file wins; re-read.

## Context Isolation

- With a manager, accept orchestrated invocation as child `delegate`, contexto mínimo (fresh) (see Runtime & Delegation).
- Pass only minimal artifacts: request, paths, `AGENTS.md`, `spec.md`, `plan.md`.
- Orchestrated mode: no guardian, no user conversation; return the `DELEGATION_RESULT` (step 15).

## Final Response

Reply with:

- `Summary`: validation goal and status of `validation.md`.
- `Validation Plan`: items `V#` with bound requirements, concrete methods/commands and expected evidence.
- `Validation Progress`: statuses per item and who promotes each (`workflow-validator`).
- `Open items`: blockers, unapproved spec/plan, or `none`.
- `Evidence`: files read/updated and confirmed facts supporting the plan.

Orchestrated mode: replace the human answer with the `DELEGATION_RESULT`.
