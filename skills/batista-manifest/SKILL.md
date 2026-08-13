---
name: batista-manifest
description: Orchestrates and reviews the full feature workflow in `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/`, creating and maintaining `manifest.md`, `spec.md`, `ux.md`, `arch.md` and `plan.md`. Use as `/skill:batista-manifest` when the user asks for the complete flow (spec → ux ∥ arch → plan), a persisted execution plan, feature creation/review, overall status, resumption, long-running work or parallelism. For execution, use `/skill:batista-execute`.
---

# Feature Manifest

## Runtime & Delegation

Read `../../references/WORKFLOW_COMMON.md` (Pi runtime, delegation, isolation, state reconciliation, checkpoints) and `../../references/PI_ADAPTATION.md`.

Authorship orchestrator: coordinates `batista-spec`, `batista-ux`, `batista-arch`, `batista-plan`, `batista-validation` via children `delegate` (`Agent`), never emitting `/skill:*`. Execution: `batista-execute`. External entry point: `/skill:batista-loop`.

Scope: the feature's workflow documents only — never product code, tests, configs, migrations or files outside the feature folder.

No guessing: investigate first, cite concrete evidence, record premises unconfirmed via file, command, log, test, browser or user answer as blocker/pending.

## Workflow

1. Read `AGENTS.md`, validate paths; apply the `list` + `get` preflight from `../../references/WORKFLOW_COMMON.md` for `delegate` and `artifact-guardian`.
2. Existing feature dir/file input → select and re-read artifacts; do not create another feature. New request → create `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/`. Orchestrated (sub-feature): use exactly the feature dir passed in — never derive `{feature-dir}/{name}/` or `{root}/{name}/` (subpasta nova é estrutura inválida; ver `../../references/WORKFLOW_COMMON.md`).
3. Reconcile status, questions, gates, guardians, evidence per `State Reconciliation`; most specific file beats the manifest.
4. Create/update `manifest.md` with links, real state and resume point.
5. Dispatch from the first missing/blocked/invalid artifact or the resume point; don't restart from spec already `ready` and approved.
6. `batista-spec`: `Author → Guardian Handshake`. `blocked` → persist `Clarifications Needed`, present to user, yield turn; never answer by assumption.
7. Valid spec → apply **Solution Gate**: `Shared Contract` closed; UX/Arch recorded `not-applicable` or `draft` before delegation.
8. Each applicable solution: `Author → Guardian Handshake`; `batista-ux` ∥ `batista-arch` may share one call if write sets are disjoint. Pass the spec's `Discovery Ledger` (`D#`). Product/contract questions return to spec.
9. Plan only when: spec + applicable solutions `ready` with guardian `approved`, non-applicable solutions explicitly `not-applicable`, shared contract closed.
10. `batista-plan`: `Author → Guardian Handshake`. Product/contract blocker reopens the smallest source skill; manager never edits the leaf artifact.
10b. **User Scope Gate** (mandatory when the spec has expansion beyond the literal request): after plan `ready` + guardian `approved`, present to the user the spec `Scope Size Estimate` + plan `Size Estimate` and the Scope Budget verdict, and ask for explicit scope confirmation before any validation/execution. Record `Scope confirmed by user: {timestamp}` in the manifest. Standalone: ask directly and wait. Loaded by `batista-loop`: relay the gate to the user and block until answered; guardian approval is not user confirmation.
11. `batista-validation`: write `validation.md` (Validation Plan before any validation; `Validation Progress` item a item) — `Author → Guardian Handshake`. Only when plan is `ready` with guardian `approved` AND (no expansion OR `Scope confirmed by user` recorded). Product/contract blocker reopens the smallest source skill; manager never edits the leaf artifact.
12. Re-read all artifacts; mark `ready` only with states/gates/guardians persisted and zero material questions.
13. Loaded by `batista-loop` → no `Final Response`; return control to the loop's next step in the same turn. Standalone → respond per `Final Response`.

### Resume Dispatch

| Real state | Next action |
|---|---|
| Spec missing/draft/blocked/rejected | `batista-spec` |
| Spec ready; applicable UX/Arch incomplete | `batista-ux`/`batista-arch` |
| Solutions ready; plan incomplete | `batista-plan` |
| Plan ready+approved; user scope gate open | manifest `blocked`; ask the user |
| Plan ready+approved; validation missing/draft | `batista-validation` |
| Material question open | manifest `blocked`; ask the user |
| All ready and approved | manifest `ready`; return to `batista-loop` |

### Author → Guardian Handshake

1. Resolve this installation's exact `SKILL.md`; delegate the leaf via `Agent({ subagent_type: "delegate", ... })` (interface real: `../../references/PI_ADAPTATION.md`; modelo herdado, contexto mínimo, cwd da sessão raiz), prompt from `../../references/WORKFLOW_COMMON.md`; never pick a skill by name only.
2. Re-read the artifact. Material question → persist `blocked` in the manifest, skip the guardian.
3. No questions, internal gates complete (except the self-referential approval gate) → delegate the rubric to `artifact-guardian`; it never edits files.
4. Rejected → increment iteration budget, re-invoke author with feedback, or block when decision/evidence is missing.
5. Approved → re-invoke the author only to persist approval, mark the guardian gate, promote to `ready`; re-read the file before updating the manifest.

## Solution Gate

Precedence (apply in this order):

1. **`Validation surfaces`** define the technical scope. Mapping:
   - `frontend` → `/skill:batista-ux`
   - `backend`, `API`, `job`, `consumer`, `infra` → `/skill:batista-arch`
   - `browser` without UI change → validation in `batista-plan`/`batista-execute` (harness); does not trigger `batista-ux`
   - `browser` with UI/flow change → also triggers `batista-ux`
2. **`Intent Classification`** only reduces the solution when **both** hold:
   - `User intent: punctual/localized`
   - `Coverage expectation: only affected flow`
   - And the relevant surfaces are a minimal subset (e.g., one handler, one component, one endpoint) with no new shared contract in `Shared Contract`
3. If `Intent Classification` and surfaces diverge, **surfaces win** — run applicable `batista-ux`/`batista-arch` or reopen the spec.
4. `Shared Contract` must be `closed` or `none` before spawning `batista-ux`/`batista-arch`; `pending` → re-invoke `batista-spec`. Never parallelize a solution with an open shared contract.

Reference cases:

| Case | UX | Arch |
|---|---|---|
| Frontend only | `batista-ux` | `not-applicable` |
| Backend/infra only | `not-applicable` | `batista-arch` |
| Fullstack | `batista-ux` ∥ `batista-arch` | `batista-ux` ∥ `batista-arch` |
| Pure infra/config | `not-applicable` | `batista-arch` |
| Punctual fix (intent + coverage ok, no shared contract) | `not-applicable` | `not-applicable` → straight to `batista-plan` |

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
- Validation: missing | not-applicable | draft | ready | blocked
- Scope confirmed by user: {none | not-required — no expansion | {timestamp}}
- Spec Guardian: missing | pending | approved | rejected
- UX Guardian: missing | not-applicable | pending | approved | rejected
- Arch Guardian: missing | not-applicable | pending | approved | rejected
- Plan Guardian: missing | pending | approved | rejected
- Validation Guardian: missing | not-applicable | pending | approved | rejected

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

- `manifest.md` is an index, not a substitute for `spec.md` or `plan.md`.
- Never assume status, resume point, blockers or evidence; confirm in docs/commands or record pending.
- User says "fix"/"implement"/"execute" → still refine artifacts via subagents and return to `batista-loop`; only standalone invocation points to `/skill:batista-execute`. No product patch.
- No extensive technical detail in the manifest.
- Spec returns `Clarifications Needed` → relay questions to user, re-invoke spec with answers; never `ready` with open clarifications nor answer by guessing.
- `spec.md` blocked on a product decision → leave `plan.md` missing or marked blocked.
- `plan.md` diverges from `spec.md` → stop and update the spec first.
- On completion, the manifest must point to enough evidence to validate the DoD.
- Never `ready` when the next run would have to guess contract, persistence, harness or target files.
- Apply the `Solution Gate` with surfaces > intent precedence; record `not-applicable` in the manifest when the skill creates no file.
- `not-applicable` in the manifest satisfies the solution gate; `missing` after the solution step is a blocker.
- Spec, applicable ux/arch, plan and validation guardians are always mandatory and independent (validation guardian required when a `validation.md` applies).
- **User Scope Gate** is mandatory on any spec expansion beyond the literal request: never dispatch `batista-validation` or execution without `Scope confirmed by user` recorded in the manifest. Guardian approval never replaces user confirmation.
- **Iteration budget**: increment `Iterations used` on every rejection or author re-invocation; after 3 attempts without new evidence, force `Status: blocked` and report.
- Spec changes invalidate UX/Arch/Plan/Validation and their guardians; UX/Arch changes invalidate Plan/Validation and their guardians; plan (or spec) substantive changes invalidate `validation.md` (draft + guardian `pending`) and its guardian. Persist the resets before the next dispatch.
- Durable outcomes (convention, architecture decision, repeated procedure) → project (`AGENTS.md`, project-local skills, `docs/adr`); ephemeral stays in `.features/{...}/`.
- Existing file/dir input → review mode: fix/refine `manifest.md`, `spec.md` and/or `plan.md` before concluding; never accept inherited `ready` unchecked.
- Never mark `done` with a pending question, blocker, `pending` evidence, rejected/pending guardian or undefined resume point in spec, plan or manifest.
- Execution, operational resumption or worker-coordination requests → route to `/skill:batista-execute`.

## Checkpoint (mandatory)

Before **every** `Agent` call or yielding the turn, write to `manifest.md`: `Updated:`, Spec/UX/Arch/Plan + guardian statuses, resume point, blockers. Never delegate with stale `manifest.md`.

## State & Memory

- Source of truth is the file, not the context. Write the delta (status, resume point) to `manifest.md` before proceeding (write-before-forget).
- Context keeps only: feature dir, current artifact/step, open blockers, next action. Everything else is a pointer (path + resume point), re-read on demand.
- Before yielding the turn or compacting: ensure `manifest.md` reflects real state; discard subagent transcripts (keep only {produced docs, status, evidence}).
- Compacting = projecting into pointers, never inventing. A summary never upgrades status. On divergence, the file wins; re-read.
- Learnings flush: on feature close, promote the durable subset (conventions, architecture decisions, repeated procedures) to the project; the rest dies with `.features/{...}/`.

## Context Isolation

- Never run spec/ux/arch/plan/validation inline when delegation is possible.
- Delegate spec, ux, arch, plan, validation and guardians via `Agent({ subagent_type: "delegate"|"artifact-guardian", ... })` (interface real e regras: `../../references/PI_ADAPTATION.md`), sempre com contexto mínimo (prompt por path; sem `inherit_context`; o child herda o cwd da sessão raiz).
- Run applicable `batista-ux`/`batista-arch` in parallel when supported; otherwise serialize; pass only the spec as anchor contract plus needed docs.
- Pass minimal context: request, paths, `AGENTS.md`, feature dir and relevant docs.
- tool `Agent` unavailable → follow `../../references/PI_ADAPTATION.md`: record a blocker; never simulate guardian or inline authorship.

## Final Response

On completion, respond with:

- `Summary`: spec/plan/manifest created or refined and overall status.
- `Will be done`: planned scope in product language, no excessive detail.
- `Next action`: standalone → execution with `/skill:batista-execute`; loaded by the loop → return to the controller; or needed clarification.
- `Pending`: blockers, open questions or `none`.
- `Evidence`: files read/updated and confirmed facts.
