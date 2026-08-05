---
name: batista-plan
description: Creates, reviews and maintains only the technical `plan.md` of a feature in `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/plan.md`, from `spec.md` and the `ux.md`/`arch.md` solutions when applicable. Use as `/skill:batista-plan` when the user asks for a technical plan, impact map, technical investigation, phases, tasks, subagents, parallelism, parallelizable plan, validation, harness, loop engineering or review of an existing feature. To execute the plan, use `/skill:batista-execute`.
---

# Feature Plan

## Runtime & Delegation

Read and follow `../../references/WORKFLOW_COMMON.md` for Pi runtime, delegation, isolation, state reconciliation and checkpoints.

Scope: feature workflow docs only — never product code, tests, configs, migrations or files outside the feature folder.

No guessing: investigate before concluding, cite concrete evidence, register as blocker any premise unconfirmable via file, command, log, test, browser or user answer.

Invoked by another feature-workflow skill? Run as child `delegate`, `context: "fresh"` (see `../../references/PI_ADAPTATION.md`), receiving only request, project root, feature dir and needed docs.

## Workflow

1. Read project `AGENTS.md`.
2. Determine mode: **standalone** (direct invocation) or **orchestrated** (child of `batista-manifest`). If input is a feature dir or file, read existing artifacts before deciding status.
3. Locate the feature `spec.md`. If missing, register blocker and return to manager; do not emit `/skill:batista-spec`. Read `ux.md` and `arch.md` when present (solution sources: usability/architecture); reconcile contract conflicts, register blocker if unresolvable.
4. Review existing state: open questions, contradictory decisions, weak DoD, missing contract/persistence/harness, spec/plan/manifest divergence, missing evidence.
5. If `spec.md` is `draft` or `blocked`, do not invent product decisions; record the block.
6. Preflight before planning implementation: AGENTS, Graphify when present, worktree, affected contracts, existing/new files, available validation commands.
7. Produce `Impact Map` before phases/tasks: affected surfaces, evidence, files/owners, need for change, validation, risk. Backend tasks derive from `arch.md` decisions; frontend tasks from `ux.md`. The plan reconciles both parallel solutions.
8. Each task/phase derives from one or more `Impact Map` rows.
9. Build a DAG of phases/tasks: dependencies, write sets, shared validations, sync points.
10. Group parallel batches when tasks/phases are independent, have disjoint write sets and own validation.
11. If contract, persistence, harness, Impact Map or target files are ambiguous, register blocker in `plan.md` with `Escalation: spec | ux | arch | manifest` and return to manager — this skill never edits `spec.md`/`ux.md`/`arch.md`; never create an executable plan by guessing.
12. Create/update only `plan.md`.
13. Orchestrated: record `draft` (or `blocked`) and return without guardian; only a re-invocation with real verdict `approved` persists the gate and promotes to `ready`. Standalone: delegate the rubric to `artifact-guardian`.
14. Standalone: if guardian rejects, apply the smallest needed fix in `plan.md` or register blocker and re-validate. Never conclude with guardian pending or rejected.
15. Update status before and after each task during execution.
16. Orchestrated: return only the `Delegation Result` (see `../../references/WORKFLOW_COMMON.md`); else respond per `Final Response`.

## Template

```markdown
# {Feature} Execution Plan

Status: draft | ready | blocked | running | done | fail
Spec: ./spec.md
Updated: {YYYY-MM-DD HH:MM}

## Execution Rules

- Update status before and after each task.
- Never mark `done` without practical working evidence.
- Record real files when they diverge from planned.
- Record blockers with cause, impact and next action.
- Do not start implementation if contract, persistence, harness or target files require guessing.
- Focused automated tests belong to the task worker; the broad suite belongs to the phase-final gate.

## Readiness Gates

- [ ] `AGENTS.md` read.
- [ ] Solution consumed: applicable `ux.md`/`arch.md` read and reconciled (or `not-applicable`).
- [ ] Graphify checked and used when configured.
- [ ] Dirty worktree recorded, with rule not to overwrite parallel changes.
- [ ] Public/internal contracts and persistence defined or marked `none`.
- [ ] Existing/new target files verified.
- [ ] Impact Map complete, with evidence per surface.
- [ ] Minimal harness defined with baseline, focused test and final validation.
- [ ] Guardian approved the plan against spec and applicable solutions (`batista-ux`/`batista-arch`).

## Impact Map

| Surface | Evidence | Why it matters | Files/Owners | Change? | Validation | Risk/Notes |
|---|---|---|---|---|---|---|
| {backend/frontend/job/infra/API/browser/etc.} | {file, command, log, test, browser or decision} | {impact on requirement} | {paths/owners} | {yes/no/pending} | {concrete check} | {risk or blocker} |

## Phase 0: Preflight

Status: pending | running | done | fail
Owner/Subagent: main
Dependencies: none
DoD:
- [ ] Execution can start without guessing decisions.
Required Evidence:
- `AGENTS.md` read, Graphify/worktree verified, Impact Map complete, target files verified, validation commands defined.
Produced Evidence:
- {pending}
Blockers:
- {none}

## Phase 1: {Name}

Status: pending | running | done | fail
Owner/Subagent: {main | subagent-name | unassigned}
Dependencies: {none | phase/task}
Parallel Group: {sequential | batch-id}
DoD:
- [ ] {Verifiable phase outcome}
Required Evidence:
- {practical evidence: browser, API, consumer, log, manual smoke, command/output, screenshot or focused test}
Produced Evidence:
- {pending}
Blockers:
- {none}

### Task 1.1: {Name}

Status: pending | running | done | fail
Owner/Subagent: {main | subagent-name | unassigned}
Parallel Group: {sequential | batch-id}
Planned Files:
- {path}
Write Set:
- {paths/patterns owned by this task}
Actual Files:
- {pending}
DoD:
- [ ] {Verifiable task outcome}
Required Evidence:
- {minimal evidence}
Produced Evidence:
- {pending}
Blockers:
- {none}

## Parallelism

- Batch 1: {independent tasks/phases that can start together}
- Batch 2: {tasks/phases released after Batch 1}
- Must stay sequential: {tasks/phases with dependency, shared write set or blocking validation}
- Synchronization points: {where to wait for validation before the next batch}

## Validation Harness

- Baseline: {command before patch, or reason to skip}
- Task-scoped automated tests: {focused tests/typecheck/lint/build the worker must run for the changed scope}
- Integration/API/consumer: {commands, probes, logs, fixtures}
- Browser/UI: {URL, steps, selectors, screenshot/console/network evidence}
- Phase final validation: {broad suite/final checks at phase end; worker fixes on failure}
- Practical evidence: {observable proof the affected behavior worked}
- Graphify: {update/sync command when source architecture changed, or none}
- Regression loop: {run -> inspect failure -> patch smallest point -> rerun -> record evidence}

## Loop Ledger

- {timestamp} | Command: {cmd} | Result: {pass/fail/blocker} | Next action: {action}

## Guardian Review

Status: pending | approved | rejected
Questions:
- {none | questions blocking execution}
Critiques:
- {none | critiques blocking execution}
Required Changes:
- {none | mandatory adjustments}

## Resume Point

- Last completed task: {none}
- Next task: {task}
- Current blockers: {none}
```

## Artifact Guardian

Standalone runs `artifact-guardian` after updating `plan.md`; orchestrated leaves the guardian to the manager after receiving the artifact.

Guardian never edits files. It validates adherence to spec and applicable solutions (`batista-ux`/`batista-arch`), Impact Map, target files, write sets, DAG, parallel batches, sync points, harness, DoD, blockers, resume point and evidence without guessing.

Mandatory rubric; record each result in the `evidence` field of the canonical `DELEGATION_RESULT`:

- [pass/fail] Impact Map covers all `Validation surfaces` of the spec (or justifies `not-applicable`).
- [pass/fail] Frontend tasks derive from `ux.md`; backend tasks from `arch.md` (or spec when solution N/A).
- [pass/fail] `batista-ux`↔`batista-arch`↔`Shared Contract` conflicts resolved in the plan or escalated with explicit `Escalation`.
- [pass/fail] Write sets, DAG, batches and sync points are explicit and safe.
- [pass/fail] Harness cites concrete commands/checks; no generic placeholders.

Any `fail` forces `status: rejected`. Copy `evidence`, `questions`, `blockers` and `resume` to `Guardian Review`; fix `plan.md` when the answer is available or register blocker with `Escalation` when decision/evidence is missing. Use `Status: ready`/`done` only with guardian `approved`.

## Rules

- Allowed statuses: `draft`, `ready`, `blocked`, `running`, `done`, `fail`.
- Never plan files/commands/harness/dependencies/parallelism by assumption; confirm in repo or register blocker.
- Never mark `plan.md` executable without a complete `Impact Map`.
- Every task/phase must reference a mapped surface; surface without evidence becomes blocker/pending.
- Prefer parallelizable plans when safe: split tasks by disjoint write set, independent contract and own validation.
- Do not serialize independent tasks for convenience; record an explicit parallel batch.
- Do not parallelize tasks sharing files, migrations, state, contract, critical fixtures or sequential validation.
- Even on "fix"/"implement"/"execute" requests, create/refine `plan.md` and return to the manager; only standalone points to `/skill:batista-execute`. No product patches.
- Every phase/task needs own DoD, owner/subagent, planned/actual files, required/produced evidence and blockers.
- Every feature needs `Phase 0: Preflight` and `Readiness Gates`.
- Harness must cite concrete practical commands/checks or register blocker; generic placeholders do not suffice.
- A referenced test that does not exist yet must appear as a planned new file.
- No full suite per task: focused automated tests per task; broad suite/final checks at phase close.
- Done requires practical working evidence, not code review or diff reading.
- Parallelize only independent tasks; record dependencies, write sets and sync points.
- For long-running work, keep checkpoints, evidence and resume point.
- On receiving an existing file/dir, treat as review: fix/refine `plan.md` before concluding; never accept inherited ready status unchecked.
- If review reveals a pending product decision, register blocker in `plan.md` with `Escalation: batista-spec` (or `batista-ux`/`batista-arch`) and return to `batista-manifest` — do not edit other artifacts.
- Never mark `done` if any phase/task still has a blocker, `pending` evidence, unproven DoD or unapproved guardian.
- If `manifest.md` exists, update only status/resume point when needed.
- Execution, operational resume or worker coordination requests: forward to `/skill:batista-execute`.
- Do not accept a generic guardian; it must list verified evidence or block with objective question/critique.

## Skill Extraction

Repetitive work becomes a project skill, not boilerplate copied into the plan.

- Trigger: the same recipe (sequence of steps/commands/validation) appears in ≥ 2–3 tasks/phases of the plan, or in previous features. Record the candidate as a note in `plan.md`.
- Action: plan an extraction task delegating to a subagent (environment `create-skill`/`skill-creator` conventions) to implement a project-local skill in `{project}/skills/{skill-name}/`, with validation guardian. Subsequent tasks call the skill instead of re-deriving.
- Extraction runs **only** in the main worktree (base branch), **after** merging parallel features, **one at a time** — never parallel to another extraction or sub-feature worktrees. Exclusive write set: `{project}/skills/{skill-name}/`.
- Guardrail (skill YAGNI): one-off does not become a skill. Plan extraction only with real repetition and a stable procedure.

## Checkpoint (mandatory)

Before **every** guardian, parallel batch or turn handoff, record in `plan.md`: `Updated:`, resume point, blockers, latest evidence. Never trigger a guardian with a stale `plan.md`.

## State & Memory

- File is the source of truth, not context. Write the delta to `plan.md` (status, evidence, loop ledger, resume point) before proceeding (write-before-forget).
- Context holds only: feature dir, current phase/task, open blockers, next action. Everything else is a pointer (path + resume point) re-read on demand.
- Before handing off/compacting: ensure real resume point/evidence in file; collapse `Loop Ledger` to last 10 + per-phase rollup; discard subagent transcripts (keep only {files, commands, evidence}).
- Compact = project into pointers, never invent. A summary never upgrades status (pending→done). On divergence, the file wins; re-read.
- Memory routing: what outlives the feature (durable architecture decision, repeated procedure turned skill) goes to the project; ephemera stays in `.features/{...}/`.

## Context Isolation

- With a manager, accept orchestrated invocation as child `delegate`, `context: "fresh"` (see Runtime & Delegation).
- Do not inherit irrelevant manager-session context.
- Pass only minimal artifacts: request, paths, `AGENTS.md`, `spec.md`, applicable `ux.md`/`arch.md`, feature docs.
- Orchestrated mode: no guardian, no user conversation; return the `Delegation Result` (step 16).

## Final Response

Reply with:

- `Summary`: technical goal of the plan and status.
- `Will do`: main phases/tasks, parallel batches and sync order.
- `Mapped impact`: affected surfaces and main evidence.
- `Planned validation`: commands, browser/API/consumer checks, expected evidence.
- `Open items`: blockers, open decisions or `none`.
- `Evidence`: files read/updated and confirmed facts supporting the plan.

Orchestrated mode: replace the human answer with the `DELEGATION_RESULT`.
