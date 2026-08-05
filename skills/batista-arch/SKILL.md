---
name: batista-arch
description: Creates, reviews and maintains only the `arch.md` architecture of a feature in `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/arch.md`, from `spec.md`, conditional on an affected backend surface. Use as `/skill:batista-arch` when the user asks for architecture, technical design, data model, contract/API design, architectural decision (ADR), tradeoffs, migration, rollback, failure modes or technical review of a feature with backend.
---

# Feature Architecture

Closes the feature **architecture** before the technical plan, when backend is affected.

## Runtime & Delegation

- Follow `../../references/WORKFLOW_COMMON.md` (Pi runtime, delegation, isolation, state reconciliation, checkpoints).
- Edit only feature workflow docs; never product code, tests, configs, migrations or files outside the feature dir.
- No guessing: investigate first, cite concrete evidence; any premise unconfirmed by file/command/log/test/browser/user answer goes to `pending`/blocker.
- Invoked by another workflow skill → run as child `delegate`, `context: "fresh"` (see `../../references/PI_ADAPTATION.md`), receiving only request, project root, feature dir and needed docs.

## Applicability

- Write `arch.md` only when `spec.md` shows affected backend/API/job/consumer/infra/data surface (spec `Validation surfaces`).
- Otherwise don't create it: answer `arch not applicable` with the evidence (spec surfaces) and return control.
- Runs in parallel with `/skill:batista-ux`; both use the same spec as anchor contract.

## Workflow

1. Read project `AGENTS.md`.
2. Mode: **standalone** (direct user invocation) or **orchestrated** (invoked by `batista-manifest` in a subagent — no mid-way user questions). See `Clarification Protocol`.
3. Locate feature `spec.md`. Missing/`draft`/`blocked` → register blocker, set `Status: blocked`, return to manager; never emit `/skill:batista-spec`.
4. Confirm applicability (backend surface in spec); otherwise stop per `Applicability`.
5. Existing `arch.md` input → treat as review: read before deciding status.
6. **Technical Discovery**: start from the spec `Discovery Ledger` (`D#` passed by manifest); trace components, data model, contracts, integrations, jobs/consumers, telemetry. Record spec-uncovered architecture findings in the `Architecture Ledger` (`A#`, source, evidence). If the spec ledger is insufficient for design decisions, run full discovery and escalate via `Open Questions`. Use Graphify when `graphify-out/graph.json` exists.
7. Define **approach** vs alternatives (ADR-lite) with rationale and tradeoffs, aligned to the spec `Shared Contract`.
8. Close: component boundaries, data model/schema, contract design (endpoints/payloads/versioning), interaction sequence, failure modes, migration and rollback, non-functionals (perf/security/scale).
9. Traceability: link every architectural decision to a spec EARS requirement and an `A#` from Discovery.
10. Product doubt → orchestrated: `Open Questions` + `Status: blocked`; standalone: ask.
11. Write or update only `arch.md`.
12. Orchestrated: save `draft` (or `blocked`) and return without guardian; only a re-invocation with a real `approved` verdict persists the gate and promotes to `ready`. Standalone: delegate the rubric to `artifact-guardian`, apply the minimal fix, repeat until `approved`.
13. Respond per `Final Response`; orchestrated returns only the `Delegation Result` from `../../references/WORKFLOW_COMMON.md`.

## Template

```markdown
# {Feature} — Architecture

Status: draft | ready | blocked
Spec: ./spec.md
Created: {YYYY-MM-DD HH:MM}
Updated: {YYYY-MM-DD HH:MM}

## Applicability

- Backend affected: {yes | no} — evidence: {spec surfaces}

## Architecture Ledger

| ID | Source | Finding | Evidence | Impact | Status |
|---|---|---|---|---|---|
| A1 | {component/schema/contract/integration/doc} | {fact or technical gap} | {path, excerpt, command, log} | {how design changes} | confirmed/pending |

## Approach (ADR-lite)

- Chosen: {approach}
- Alternatives: {A) ... | B) ...}
- Rationale: {why chosen}
- Tradeoffs: {accepted cost}

## Component Boundaries

- {affected/new components and responsibilities/limits}

## Data Model

- {entities, schema changes, indexes, invariants, or none}

## Contract Design

- {endpoints/events, payloads, versioning, compatibility, or none}

## Interaction / Sequence

- {interaction sequence across components for the target flow}

## Failure Modes & Rollback

- Failure modes: {what can fail and the effect}
- Migration: {order, backfill, or none}
- Rollback: {git revert | specific step if migration/contract/flag touched}

## Non-Functional

- {perf, security, scale, relevant limits or none}

## Architecture Traceability

| Requirement (EARS back) | Architectural decision | Affected contract/data | Validation | Basis | Status |
|---|---|---|---|---|---|
| {spec req} | {decision} | {contract/schema} | {command/probe/log/test} | {A# or decision} | defined/pending |

## Open Questions

- {none | technical question blocking ready}

## Readiness Gates

- [ ] `AGENTS.md` and `spec.md` read.
- [ ] Approach chosen with alternatives and tradeoffs.
- [ ] Data model and contract design closed or `none` justified.
- [ ] Migration and rollback defined when state/contract changes.
- [ ] Every backend requirement has a traceable architectural decision (`A#`).
- [ ] Guardian approved `arch.md`.

## Definition of Done

- [ ] Architecture sustains every backend requirement with traceability.
- [ ] Contract and persistence designed, not merely cited.
- [ ] Migration/rollback and failure modes defined.
- [ ] Guardian approved.
```

## Artifact Guardian

- Standalone: after updating `arch.md`, run `artifact-guardian`. Orchestrated: the manager runs it after receiving the artifact.
- The guardian never edits files; it validates architecture without guessing.
- Mandatory rubric; record each result in the `evidence` field of the canonical `DELEGATION_RESULT`:

- [pass/fail] Every spec backend requirement has a supporting architectural decision.
- [pass/fail] Chosen approach has explicit alternatives and tradeoffs.
- [pass/fail] Data model supports requirements; contract designed (not just "changes: yes").
- [pass/fail] Migration and rollback defined when state/contract changes.
- [pass/fail] Every decision references an `A#` from Discovery or a registered decision.
- [pass/fail] Relevant failure modes and non-functionals covered or `none` justified.

Any `fail` forces `status: rejected`. Treat `evidence`, `questions`, `blockers`, `resume` as feedback: fix `arch.md` when the answer is available, ask the user (standalone) or record in `Open Questions` (orchestrated). Only `Status: ready` with guardian `approved`.

## Rules

- Technical design and decisions only; no task decomposition (that's `batista-plan`).
- Don't decide product: a missing product decision becomes a blocker pulled to `spec.md`.
- Actually design contract and data model; "contract changes: yes/no" is not enough.
- Approach without explicit alternative/tradeoff is rejected by the guardian.
- Migration and rollback mandatory when schema/contract/flag touched.
- Every decision references an EARS requirement and an `A#`, or becomes `pending`.
- Even if the user says "implement", this skill creates/refines `arch.md` and stops.
- Existing `arch.md` → review; never inherit a ready status unchecked.
- Runs in parallel with `batista-ux` without seeing `ux.md`; conflict with `Shared Contract` or a UX premise becomes `Open Questions` (orchestrated: `Status: blocked`); final reconciliation in `batista-plan`.
- No generic guardian: it lists verified evidence or blocks with objective question/critique.

## Clarification Protocol

- Standalone: batch-ask the user, record resolved items in `Open Questions`, continue.
- Orchestrated: never ask mid-way; fill `Open Questions` with `Q#` IDs, set `Status: blocked`, save `arch.md`, return to the manager with the block copied in the final response.

## Checkpoint (mandatory)

Before **every** guardian run or turn handover, save to `arch.md`: `Updated:`, `Status`, `Open Questions`, blockers.

## State & Memory

- Source of truth is the file, not context; write the delta to `arch.md` before proceeding (write-before-forget).
- Context holds only: feature dir, current decision/contract, open blockers, next action. The rest is a pointer, re-read on demand.
- Compacting = projecting to pointers, never inventing. A summary never upgrades status; on divergence, the file wins.
- Decisions surviving the feature go to the project (`AGENTS.md`/`docs/adr`); ephemeral stays in `.features/{...}/`.

## Context Isolation

- With a manager, accept orchestrated invocation as child `delegate` with `context: "fresh"`.
- Don't inherit irrelevant manager-session context.
- Pass only minimal artifacts: request, paths, `AGENTS.md`, `spec.md`, feature docs.
- Orchestrated: no guardian, no user conversation; return the `Delegation Result` per `../../references/WORKFLOW_COMMON.md`.

## Final Response

On completion respond with:

- `Summary`: applicability, chosen approach, status.
- `Will do`: boundaries, data, contract, sequence designed.
- `Planned validation`: commands/probes/logs per decision.
- `Open Questions` (only when `Status: blocked`): copy the block with `Q#` IDs.
- `Resume` (same case): feature dir + instruction to re-invoke with `Q#` answers.
- `Pending`: blockers, technical questions or `none`.
- `Evidence`: files read and facts supporting `arch.md`.

Orchestrated: replace the human response with the `DELEGATION_RESULT`.
