---
name: batista-ux
description: Creates, reviews and maintains only the `ux.md` usability document of a feature in `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/ux.md`, from `spec.md`, conditional on an affected frontend surface. Use as `/skill:batista-ux` when the user asks for usability, usage flow, screen states, error prevention, feedback, accessibility, or review of the experience of a frontend feature.
---

# Feature UX

## Runtime & Delegation

- Follow `../../references/WORKFLOW_COMMON.md` for Pi runtime, delegation, isolation, state reconciliation and checkpoints.
- Close feature **usability** before the technical plan, when frontend is affected. Usability only — aesthetics, tokens or pixels go to `frontend-design` at execution.
- Edit only feature workflow documents. Never product code, tests, configs, migrations or files outside the feature dir.
- No guessing: investigate first, cite concrete evidence; mark `pending` any claim unconfirmed by file, command, log, test, browser or user answer.
- Invoked by another feature-workflow skill → run as child `delegate` with `context: "fresh"` (see `../../references/PI_ADAPTATION.md`), receiving only request, project root, feature dir and needed docs.

## Applicability

- Create `ux.md` only when `spec.md` shows an affected frontend/UI surface (spec's `Validation surfaces`).
- No frontend affected → don't create the file: answer `ux not applicable` with evidence (spec surfaces) and return control.
- Runs in parallel with `/skill:batista-arch`; both anchor on the same spec contract.

## Workflow

1. Read the project `AGENTS.md`.
2. Determine mode: **standalone** (user invoked directly) or **orchestrated** (`batista-manifest` subagent — don't ask mid-run). See `Clarification Protocol`.
3. Locate the feature `spec.md`. Missing or `draft`/`blocked` → register blocker, set `Status: blocked`, return to manager; don't emit `/skill:batista-spec`.
4. Confirm applicability (frontend surface in spec). Not applicable → stop per `Applicability`.
5. Input is an existing `ux.md` → treat as review: read before deciding status.
6. **Usability Discovery**: start from the spec `Discovery Ledger` (`D#` received via manifest). Trace usage flows, screens/routes, reusable components, states and a11y baseline. Log UX findings not covered by the spec in the `Usability Ledger` as `U#` with source and evidence. Spec ledger insufficient for the design decision → full discovery, escalate with `Open Questions`. Use Graphify when `graphify-out/graph.json` exists.
7. For each spec frontend requirement (EARS form), design usability aligned to the spec `Shared Contract`: efficient task flow, states (empty/loading/error/success), error prevention and recovery, feedback and state visibility, consistency, cognitive load, accessibility.
8. Build traceability: every usability decision linked to a spec EARS requirement and a Discovery `U#`.
9. Close states, a11y and out of scope before `Status: ready`. Product doubt → orchestrated: `Open Questions` + `Status: blocked`; standalone: ask.
10. Write or update only `ux.md`.
11. Orchestrated: save `draft` (or `blocked`) and return without guardian; only a re-invocation with a real verdict `approved` may persist the gate and promote to `ready`. Standalone: delegate the rubric to `artifact-guardian`, apply the minimal fix and repeat until `approved`.
12. Respond per `Final Response`; orchestrated: return only the `Delegation Result` from `../../references/WORKFLOW_COMMON.md`.

## Template

```markdown
# {Feature} — UX

Status: draft | ready | blocked
Spec: ./spec.md
Created: {YYYY-MM-DD HH:MM}
Updated: {YYYY-MM-DD HH:MM}

## Applicability

- Frontend affected: {yes | no} — evidence: {spec surfaces}

## Usability Ledger

| ID | Source | Finding | Evidence | Impact | Status |
|---|---|---|---|---|---|
| U1 | {screen/route/component/flow/doc/response} | {usability fact or gap} | {path, excerpt, screenshot, command} | {how flow/state changes} | confirmed/pending |

## Affected Screens & Flows

- Screens/routes: {list}
- Target task flow: {efficient step-by-step for the user to complete}

## Component & State Inventory

- Components: {reused/new}
- Estados por tela: empty | loading | error | success

## Usability Traceability

| Requirement (EARS front) | Usability decision | Covered states | Accessibility | Validation | Basis | Status |
|---|---|---|---|---|---|---|
| {spec requirement} | {flow/interaction/feedback} | {empty/loading/error/success} | {concrete a11y} | {browser/step/probe} | {U# or decision} | defined/pending |

## Error Prevention & Recovery

- Prevention: {how the design avoids the error}
- Recovery: {how the user recovers}

## Accessibility

- {keyboard navigation, focus, contrast, labels, roles — concrete per screen}

## Out of Scope

- Aesthetics/tokens/pixels: delegated to `frontend-design` at execution.
- {other exclusions}

## Open Questions

- {none | usability question blocking ready}

## Readiness Gates

- [ ] `AGENTS.md` and `spec.md` read.
- [ ] Every frontend requirement has flow, states and a11y defined and linked to a `U#`.
- [ ] Error prevention and recovery covered.
- [ ] empty/loading/error/success states covered per affected screen.
- [ ] Guardian approved `ux.md`.

## Definition of Done

- [ ] Usability of every frontend requirement closed with traceability.
- [ ] States and accessibility defined with evidence or decision.
- [ ] Practical validation (browser/steps) defined for each flow.
- [ ] Guardian approved.
```

## Artifact Guardian

- Standalone: after updating `ux.md`, run `artifact-guardian`. Orchestrated: the manager runs the guardian after receiving the artifact.
- The guardian never edits files; it validates usability only, without guessing.
- Mandatory rubric; record each result in the `evidence` field of the canonical `DELEGATION_RESULT`:

- [pass/fail] Each spec frontend requirement has an efficient task flow defined.
- [pass/fail] empty/loading/error/success states covered on every affected screen.
- [pass/fail] Error is preventable and recoverable, with visible feedback.
- [pass/fail] Concrete accessibility per screen (keyboard, focus, contrast, labels).
- [pass/fail] Each usability decision references a Discovery `U#` or a registered decision.
- [pass/fail] Scope doesn't invade aesthetics/tokens (out of scope respected).

Any `fail` forces `status: rejected`. Treat `evidence`, `questions`, `blockers`, `resume` as feedback: fix `ux.md` when the answer is available, ask the user (standalone) or log in `Open Questions` (orchestrated). `Status: ready` only with guardian `approved`.

## Rules

- Usability only; never decide aesthetics, tokens or pixels (out of scope, delegated to `frontend-design`).
- Never decide product: missing product decision → register blocker and escalate to `spec.md`.
- Every usability decision references a spec EARS requirement and a Discovery `U#`, or becomes `pending`.
- Cover empty/loading/error/success on every affected screen; a missing state is a blocker.
- Error prevention and recovery mandatory per flow.
- Concrete accessibility per screen; reject generic "follow best practices".
- Even if the user says "implement", this skill creates/refines `ux.md` and stops.
- Existing `ux.md` input → treat as review; never accept an inherited ready status unchecked.
- Runs in parallel with `batista-arch` without seeing `arch.md`; conflict with `Shared Contract` or technical premise → `Open Questions` (orchestrated: `Status: blocked`) — final reconciliation in `batista-plan`.
- No generic guardian acceptance; it lists checked evidence or blocks with an objective question/critique.

## Clarification Protocol

- Standalone: ask the user in batch, log resolved questions in `Open Questions` and continue.
- Orchestrated: never ask mid-run. Fill `Open Questions` with `Q#` IDs, set `Status: blocked`, save `ux.md` and return to the manager with the block copied in the final response.

## Checkpoint (mandatory)

Before **each** guardian or yielding the turn, persist in `ux.md`: `Updated:`, `Status`, `Open Questions` and blockers.

## State & Memory

- Source of truth is the file, not context. Write the delta to `ux.md` before moving on (write-before-forget).
- Context holds only: feature dir, current requirement/screen, open blockers, next action. Everything else is a pointer, re-read on demand.
- Compacting = projecting to pointers, never inventing. A summary never upgrades status. On divergence, the file wins.
- What outlives the feature (reusable usability pattern, a11y convention) goes to the project (`AGENTS.md`/project-local skill); ephemeral stays in `.features/{...}/`.

## Context Isolation

- With a manager, accept orchestrated invocation as child `delegate` with `context: "fresh"`.
- Don't inherit irrelevant manager-session context.
- Pass only minimal artifacts: request, paths, `AGENTS.md`, `spec.md` and feature docs.
- Orchestrated: no guardian, no user conversation; return the `Delegation Result` per `../../references/WORKFLOW_COMMON.md`.

## Final Response

On completion, answer with:

- `Summary`: applicability and `ux.md` status.
- `Will be done`: flows and states designed from a usability viewpoint.
- `Planned validation`: browser/steps per flow.
- `Open Questions` (only when `Status: blocked`): copy the block with `Q#` IDs.
- `Resume` (same case): feature dir + instruction to re-invoke with `Q#` answers.
- `Pending`: blockers, usability questions or `none`.
- `Evidence`: files/screens read and facts supporting `ux.md`.

Orchestrated: replace the human-facing response with the `DELEGATION_RESULT`.
