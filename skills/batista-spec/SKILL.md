---
name: batista-spec
description: Creates, reviews, and maintains only the `spec.md` of a feature in `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/spec.md`. Use as `/skill:batista-spec` when the user asks for a spec, specification, product contract, Definition of Done, user intent classification, requirement clarification, review of an existing feature, or when a feature needs questions before the technical plan.
---

# Feature Spec

## Runtime & Delegation

Read and follow `../../references/WORKFLOW_COMMON.md` for Pi runtime, delegation, isolation, state reconciliation, and checkpoints.

Use this skill to close the product contract before any technical plan. It may only edit feature workflow docs — never product code, tests, configs, migrations, or files outside the feature folder.

No guesswork: investigate before concluding, cite concrete evidence, and record any claim you cannot confirm via file, command, log, test, browser, or user response as `pending`.

When invoked by another feature-workflow skill, run as a child `delegate` with contexto mínimo (fresh) (see `../../references/PI_ADAPTATION.md`), receiving only the request, project root, feature dir, and needed docs.

## Workflow

1. Identify project root and feature folder. In real doubt: standalone asks; orchestrated records in `Clarifications Needed`. Use an existing `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/` when indicated; otherwise create one with local date/time and kebab-case ASCII `short-desc`.
2. Persist the literal user instruction in `user-instructions.md` (feature folder) with date/time before any processing; never summarize, edit, or remove earlier instructions.
3. Read the project `AGENTS.md`.
4. Determine execution mode: **standalone** (user invoked the skill directly; can answer questions) or **orchestrated** (invoked by another feature-workflow skill with isolated context; cannot ask mid-run). See `Clarification Protocol`.
5. If input is a feature dir or file (`manifest.md`, `spec.md`, `plan.md`), treat as review: read existing feature files before deciding status (pending questions, contradictory decisions, weak DoD, missing contract/persistence, spec/plan/manifest divergence, missing evidence).
6. Run `Phase 0: Discovery` as method, not wish: sweep dimensions — contracts/APIs, schemas/persistence, routes/handlers, consumers/jobs/queues, configs/flags, existing tests, external dependencies, telemetry/logs, owners — and **trace at least one current flow end to end**. Record every finding in the `Discovery Ledger` with `ID` (`D#`), source, evidence, impact. Claims without evidence become `pending`. Use Graphify when `graphify-out/graph.json` exists.
7. Reflect and record the user's real intent (localized/focused vs end-to-end feature) with justification from Discovery findings.
8. Raise material clarifications via the taxonomy (see `Clarification Protocol`), prioritized by (Impact × Uncertainty), max 5 high-impact per round. Only a doubt that **does not change** scope, acceptance, contract, persistence, UX, security, rollout, or validation may become an explicit assumption.
9. Resolve per mode: standalone asks in batch and waits; orchestrated fills `Clarifications Needed`, sets `Status: blocked`, returns control to the manager.
10. Build traceability: every requirement in **EARS** form linked to a Discovery `D#` or a recorded decision; every acceptance criterion in **Given/When/Then** with a validation surface (see `Requirements Grammar`).
11. Apply the **Minimalism Gate** to every requirement: (a) part of what the user asked (check literal instruction in `user-instructions.md`)? (b) essential to the user's task? If either is no, move to `Out of Scope` with a one-line justification. (c) At the lowest complexity meeting the acceptance criterion, or simplifiable? If so, simplify before proceeding. Always question motivation: who asked and why.
12. Explicitly close contract, persistence, mandatory evidence, and out-of-scope before `Status: ready`.
13. Write or update only `spec.md`. Do not write `plan.md`.
14. Apply the **Fail-Closed Clarification Gate**. Orchestrated: record `draft` (or `blocked`) and return without running guardian; only a re-invocation with a real `approved` verdict may persist the gate and promote to `ready`. Standalone: delegate the rubric to `artifact-guardian`, apply the minimal fix, repeat until `approved`.
15. Respond per `Final Response`; orchestrated returns only the `Delegation Result` from `../../references/WORKFLOW_COMMON.md`.

## Fail-Closed Clarification Gate

Before guardian or `Status: ready`, look for material decisions with `A: TBD`, `pending`, or origin `explicit assumption`. Convert each into `Clarifications Needed`, record `Status: blocked`, and return the questions. Do not run guardian or continue to UX/Arch/Plan while any occurrence exists.

## Requirements Grammar (EARS + Gherkin)

Write each requirement in EARS form (trigger + subject + response = testable):

- Ubiquitous (always active): `The system must <response>.`
- Event: `When <trigger>, the system must <response>.`
- State: `While <precondition>, the system must <response>.`
- Optional: `Where <feature present>, the system must <response>.`
- Unwanted: `If <trigger>, then the system must <response>.`
- Complex: combine trigger + state in one sentence.

Write each acceptance criterion in Gherkin: `Given <context>, When <action>, Then <observable result>` (use `And` for extra steps). Prefer 1-3 criteria per requirement; 4+ means the requirement is too large (split it).

Calibration:

- Weak requirement (vague, no trigger, untestable): "The system must handle invalid coupons correctly."
- Good requirement (EARS event): "When the user applies an expired coupon at checkout, the system must reject the coupon and show 'Coupon expired'."
- Weak acceptance: "Invalid coupons don't work."
- Good acceptance (Gherkin): "Given a cart with an expired coupon, When the user confirms checkout, Then no discount is applied And the 'Coupon expired' message appears."

## Template

```markdown
# {Feature}

Status: draft | ready | blocked
Created: {YYYY-MM-DD HH:MM}
Updated: {YYYY-MM-DD HH:MM}

## Objective

{What must exist or change from the user/system point of view.}

## Context

{Why this is needed, known current state, relevant constraints.}

## Discovery Ledger

| ID | Source | Finding | Evidence | Impact | Status |
|---|---|---|---|---|---|
| D1 | {file/command/doc/user response} | {confirmed fact or gap} | {path, short excerpt, command, or decision} | {how scope/contract/validation changes} | confirmed/pending |

## Intent Classification

- User intent: {focused/localized | end-to-end feature | pending}
- Rationale: {why this classification is correct}
- Coverage expectation: {only affected flow | full end-to-end contract | pending}

## Actors and Flows

- Actors/systems affected: {users, systems, jobs, consumers, APIs, or none}
- Current flow: {current flow traced end to end, referencing Discovery D#; `pending` only if the feature is provably greenfield}
- Target flow: {expected behavior}

## Scope

- {Included}

## Out of Scope

- {Excluded}

## Questions and Decisions

- [C1] Q: {question}
  A: {answer/decision} — origin: {user | recorded decision | explicit assumption}

## Requirements Traceability

| Need | Requirement (EARS) | Acceptance criterion (Given/When/Then) | Validation surface | Basis | Status |
|---|---|---|---|---|---|
| {user/system need} | {EARS requirement} | {Given/When/Then criterion} | {frontend/backend/job/infra/browser/API/consumer} | {Discovery D# or decision} | defined/pending |

## Contract and Persistence

- Changed contracts: {public/internal contracts or none}
- Persistence: {where state/config/data lives, or none}
- Validation surfaces: {frontend/backend/job/infra/browser/API/consumer}
- Ambiguities: {none | pending decision}

## Shared Contract

> Minimum contract shared between `batista-ux` and `batista-arch` before the parallel spawn. Use `none` when only one surface runs or a point fix has no new contract.

- Status: closed | none | pending
- Payloads/fields: {fields, types, nullability, or none}
- States and errors: {HTTP codes/domain errors, messages exposed to the user, or none}
- Minimum sequence: {who calls whom, order, or none}
- Basis: {D# or decision}

## Acceptance Criteria

- {Given <context>, When <action>, Then <observable result>}

## Clarifications Needed

> none = nothing blocks `ready`. Max 5 high-impact items, prioritized by (Impact × Uncertainty). Trivial doubts don't belong here: they become explicit assumptions in `Questions and Decisions` or `Out of Scope`.

- [C1] Category: {functional scope | data model | flow/UX | non-functional | integration/dependencies | edge cases/failures | contract | persistence | rollout | terminology}
  Question: {high-impact question}
  Blocks: {scope | contract | persistence | acceptance | rollout | validation}
  Options: {A) ... | B) ... | short answer}
  Recommended: {option + 1-sentence justification}

## Spec Readiness Gates

- [ ] `AGENTS.md` and cited sources were read.
- [ ] Every requirement is in EARS form and references a Discovery finding (`D#`) or a recorded decision.
- [ ] Every acceptance criterion is in Given/When/Then with a validation surface.
- [ ] Every requirement passed the Minimalism Gate: part of the request, essential for the project to work, at the lowest complexity meeting acceptance; the rest is in `Out of Scope`.
- [ ] `Clarifications Needed` = none, or `Status: blocked`.
- [ ] `plan.md` can be written with no pending product decision.
- [ ] `Shared Contract` = `closed` or `none` before the parallel spawn `batista-ux`∥`batista-arch`.

## Definition of Done

- [ ] Complete product result.
- [ ] Discovery and traceability support scope and acceptance criteria.
- [ ] Changed public/internal contracts are listed.
- [ ] Practical validation with real evidence or exact blocker recorded.
- [ ] Needed automated tests are split between task focus and final phase gate.
- [ ] Required real evidence for frontend/backend/job/infra is defined.
- [ ] Guardian approved the spec.
```

## Artifact Guardian

After updating `spec.md`, standalone mode runs `artifact-guardian`; orchestrated: the manager runs the guardian after receiving the artifact.

The guardian does not edit files. It validates that the spec closes discovery, objective, scope, out-of-scope, affected actors/users, flows, traceable requirements, contracts, persistence, validation, DoD, and pending questions without guesswork.

Mandatory rubric; record each result in the `evidence` field of the canonical `DELEGATION_RESULT`:

- [pass/fail] Every requirement is in EARS form (When/While/Where/If-Then/ubiquitous).
- [pass/fail] Every acceptance criterion is in Given/When/Then with a validation surface.
- [pass/fail] Every fact used in the spec references a Discovery finding (`D#`) with evidence.
- [pass/fail] `Intent Classification` is justified by findings, not guesswork.
- [pass/fail] Every requirement is part of what the user asked (literal instruction in `user-instructions.md`) and is essential to complete the user's task; nothing beyond the minimum requested entered scope (excess is in `Out of Scope`).
- [pass/fail] Every requirement's motivation was questioned: who asked and why; a requirement with no literal request nor task essentiality is in `Out of Scope` or became a user question.
- [pass/fail] Every requirement is at the lowest complexity meeting the acceptance criterion; no obvious simplification was ignored.
- [pass/fail] Taxonomy covered: no material question left unasked; `Clarifications Needed` consistent with state (none ⇒ no open high-impact item).
- [pass/fail] No material decision closed by assumption; every material answer references user, recorded decision, or `D#` evidence.
- [pass/fail] Contract, persistence, validation, and out-of-scope closed or `none` justified.
- [pass/fail] `Shared Contract` = `closed` or `none` when `batista-ux` and `batista-arch` run in parallel; fields/errors/sequence cannot stay `pending`.

Any `fail` forces `status: rejected`. Treat `evidence`, `questions`, `blockers`, and `resume` as spec feedback; fix `spec.md` when the answer is available, ask the user (standalone) or record in `Clarifications Needed` (orchestrated) when a decision is missing. Use `Status: ready` only with guardian `approved`.

## Rules

- Keep content free of implementation details.
- Ask only after investigating what the repo, docs, and existing artifacts can answer.
- Ask everything that materially shapes scope, acceptance, contract, persistence, UX, security, rollout, or validation, batched and prioritized by taxonomy (max 5 per round). Record an assumption only when it changes none of those surfaces.
- Every requirement in EARS form; every acceptance criterion in Given/When/Then. The guardian rejects form deviations.
- Every fact references a `D#` from the `Discovery Ledger` with evidence, or a recorded decision; otherwise `pending`.
- Persist the literal user instruction in `user-instructions.md` (feature folder) before any processing; define scope and requirements against it and question motivation.
- Do not mark requirements, scope, contracts, persistence, or validation as defined without evidence or a recorded decision.
- No `Status: ready` without `Discovery Ledger`, `Requirements Traceability`, and `Spec Readiness Gates` filled and `Clarifications Needed` = none.
- Done = behavior validated in practice with evidence, not code review.
- Even if the user says "fix", "implement", or "execute", create/refine `spec.md` and stop; no product patches.
- Start with the smallest scope faithful to the request; do not turn a localized fix into an end-to-end feature without evidence or an explicit decision.
- Any requirement beyond the minimum to complete the task goes to `Out of Scope`, even if useful; it returns only with an explicit user request or decision (check the literal instruction). A requirement simplifiable without losing acceptance must be simplified. Always question motivation.
- If real intent is ambiguous between point fix and end-to-end feature, record `pending` in `Intent Classification` and ask before `Status: ready`.
- `Status: ready` only when `plan.md` can be written without pending product decisions and the guardian approves.
- No `Status: ready` if contract, persistence, harness, affected user, or out-of-scope is ambiguous.
- When ambiguity blocks safe execution, ask the user (standalone) or record in `Clarifications Needed` and set `Status: blocked` (orchestrated).
- On receiving an existing file or directory, treat as review: fix/refine `spec.md` before concluding; never accept an inherited ready status unchecked.
- If `plan.md` or `manifest.md` reveals a product gap, pull it into `spec.md` as a pending question/decision.
- If `manifest.md` exists, update only spec links/status as needed for consistency.
- Do not accept a generic guardian; it must list checked evidence or block with an objective question/critique.

## Clarification Protocol

Clarify without violating isolation. Detect the mode at the start (Workflow step 4).

- Standalone (user invoked the skill directly): group material clarifications into one prioritized batch (max 5), present to the user, wait for answers, record in `Questions and Decisions`, continue. Repeat in batches if a new high-impact doubt arises.
- Orchestrated (invoked by `batista-manifest`/another skill with isolated context): never ask mid-run. Fill `Clarifications Needed` with `C#` IDs, save `spec.md`, set `Status: blocked`, and return control to the manager with the `Clarifications Needed` block copied into the final response. Do not invent answers or mark `ready`.

Taxonomy to sweep before asking (mark each Clear/Partial/Missing; Partial/Missing that changes a material surface always becomes a question): functional scope, data model, flow/UX, non-functional attributes, integration/dependencies, edge cases/failures, constraints/tradeoffs, contract, persistence, rollout, terminology, completion signals/DoD.

Resume (orchestrated), when re-invoked with answers referenced by `C#`:

1. Read `spec.md` (source of truth) and the received answers.
2. Move each resolved item from `Clarifications Needed` to `Questions and Decisions` with answer and origin; propagate impact to Scope, Requirements, Contract/Persistence, Acceptance.
3. Re-run discovery only in areas affected by the answers.
4. If a new high-impact clarification arises, reopen `Clarifications Needed` (respecting the cap of 5) and return; otherwise proceed to guardian and `ready`.

## Checkpoint (mandatory)

Before **each** guardian or yielding the turn, record in `spec.md`: `Updated:`, `Status`, implicit resume point (next clarification or guardian), and blockers. Never run guardian with an outdated `spec.md`.

## State & Memory

- The file is the source of truth, not the context. Write the delta into `spec.md` (Discovery Ledger, decisions, status) before moving on (write-before-forget).
- Context keeps only: feature dir, current requirement/clarification, open blockers, next action. Everything else is a pointer (path) re-read on demand.
- Compacting = projecting into pointers, never inventing. A summary never upgrades status (pending→confirmed/ready). On divergence, the file wins and is re-read.
- This spec's `Validation surfaces` are the gate signal for `batista-ux` (frontend) and `batista-arch` (backend/API/job/consumer/infra) at the solution stage; keep them explicit. Mapping: `frontend`→`batista-ux`; `backend`/`API`/`job`/`consumer`/`infra`→`batista-arch`; `browser` without UI change→harness in `batista-plan`/`batista-execute`; `browser` with UI→also `batista-ux`.
- `Shared Contract` must be closed before the manifest spawns `batista-ux`∥`batista-arch`; conflicts unresolved here become `pending` and block `ready`.
- What survives the feature (convention, domain terminology) goes to the project (`AGENTS.md`); ephemeral content stays in `.features/{...}/`.

## Context Isolation

- When a manager exists, accept orchestrated invocation as a child `delegate` with contexto mínimo (fresh).
- Do not inherit irrelevant context from the manager session.
- Pass only minimal artifacts: request, paths, `AGENTS.md`, and feature docs.
- Orchestrated: do not run guardian or talk to the user; return the `Delegation Result` to the manager per `../../references/WORKFLOW_COMMON.md`.

## Final Response

On completion, respond with:

- `Summary`: classified intent, objective, and agreed scope.
- `Will be done`: expected results from the user/system point of view.
- `Clarifications Needed` (only when `Status: blocked` by clarification): copy the block with `C#` IDs, category, question, what it blocks, and the recommended option.
- `Resume` (same case): feature dir + instruction that the re-invocation must pass the answers referenced by `C#`.
- `Open items`: questions, blockers, or `none`.
- `Evidence`: files read/updated and confirmed facts supporting the spec.

Orchestrated: replace the human response with the `DELEGATION_RESULT`; the root manager presents questions to the user.
