---
name: batista-loop
description: Result controller (closed loop) for a feature or epic in `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/loop.md`. Guarantees the objective is met by orchestrating `batista-manifest` and `batista-execute` in the root session and replanning/reexecuting the smallest unit until closed. Use as `/skill:batista-loop` for an end-to-end objective, autopilot, decomposition into sub-features, sequential/parallel execution, worktrees, merge/integration, or resuming a long-running objective.
---

# Feature Loop

## Mandatory runbook (simple models)

Run in order; never skip steps or compensate a child's failure:

1. Instruction paths (`../batista-execute/SKILL.md`, `../batista-manifest/SKILL.md`, `../../references/*`) are relative to this `batista-loop/SKILL.md` dir, never cwd/project root/epic dir. Unreadable real package path → record `blocked`; never simulate the routine.
2. Before the first child: `subagent({ action: "list" })`, then `subagent({ action: "get", agent: "{role}" })` per role used.
3. Every execution call carries literally:
   - worker: `subagent({ agent: "worker", model: "deepseek/deepseek-v4-flash:off", context: "fresh", cwd: "{canonical-project-root}", task: "..." })`;
   - validator: `subagent({ agent: "workflow-validator", model: "deepseek/deepseek-v4-flash:xhigh", context: "fresh", cwd: "{canonical-project-root}", task: "..." })`;
   - outcome: `subagent({ agent: "artifact-guardian", model: "inherit", context: "fresh", cwd: "{canonical-project-root}", task: "..." })`.
4. Root correction, before the worker: check ceiling/anti-thrash; persist/re-read outcome `pending`; iteration+ledger; plan/manifest/`State.Plan` `ready`; task/phase/evidence `pending`; line `manifest=ready`, `execute=fail`, `Verify=pending`, `Status=running`.
5. Correction child order: **worker → workflow-validator → artifact-guardian**; no child between worker and validator; outcome only after terminal closure, E2E, checkpoint.
6. Failed call, omitted `context`, `(no output)` or wrong child never authorizes manager product writes. Inspect the write set; wrong product → persist `fail`, dispatch a new valid worker. Without positively approved validator, never mark task/sub-feature/E2E/outcome pass/done/approved.
7. Max one dispatch per role+task/attempt. Never repeat a child for different output; real error opens a new persisted attempt; ambiguous return blocks.

## Runtime & Delegation

Follow `../../references/WORKFLOW_COMMON.md` (Pi runtime, delegation, isolation, state reconciliation, checkpoints).

Result controller: given an objective, ensure it is achieved — decide decomposition, sequence/parallelism, integration; iterate (plan/replan/execute/reexecute) until closed with evidence. Outermost plugin layer: orchestrates `batista-manifest` (authorship) and `batista-execute` (execution); never writes `batista-spec`/`batista-ux`/`batista-arch`/`batista-plan` directly nor implements product code. Root manager: load both routines with `read`; not internal slash commands. See `../../references/PI_ADAPTATION.md`.

## Manager Tool Firewall — before every `write`/`edit`

Resolve the target before the call. Root-session closed allowlist: only the selected `loop.md` and sub-features' `manifest.md`/`plan.md`. Any other path is product; call forbidden — also for one-byte trivial fixes, root gaps, empty/wrong workers, files at wrong path. Cancel and apply `batista-execute`, which dispatches a `worker`. Manager never creates, edits, moves, copies or removes product.

No guesswork: objective met only with practical evidence on the affected path. Record as blocker any premise unconfirmable via file, command, log, test, browser or user answer.

## Workflow

1. Read `AGENTS.md`, validate paths, apply preflight `list`+`get` from `../../references/WORKFLOW_COMMON.md`. Before the **first dispatch of each role**, a prior `action: "get"` must exist for it; `list` does not replace `get`. Do this for `worker`, `workflow-validator`, `artifact-guardian` and, only with pending authorship, `delegate`.
2. Existing `loop.md`/epic dir → select, re-read state; **never create another dir**. New objective → identify project root, create `.features/{YYYY-MM-DD}_{HHMM}-{short-desc}/loop.md`.
3. Fix the **verifiable objective**: expected result + acceptance evidence at result level. Material ambiguity → question and `blocked`.
4. Decide or re-read decomposition (see `Decomposition`); persist DAG, write sets, dependencies, strategy.
5. Reconcile `loop.md`, each `manifest.md` and linked artifacts per `State Reconciliation`. Downgrade optimistic indexes; file and gates beat summaries.
6. Each released **non-terminal** sub-feature with `execute`/`Status` not yet `done`/`done`: load `../batista-manifest/SKILL.md` only if manifest not truly `ready`; manifest with first `Status: done` is valid terminal when its line is `done` — never reopen. Apply it inline, orchestrated: no `/skill:batista-manifest` emission, no propagating its internal `Final Response`.
7. Re-read manifest, spec, ux/arch, plan. Accept authorship only when all literal statuses, gates, persisted guardians are valid and no material clarification. Questions → copy to user, record `blocked`, yield.
8. Valid authorship + `execute` `pending|running|fail` retry-eligible → `read` `../batista-execute/SKILL.md`, apply inline. Every call literally: `cwd: "{canonical-project-root}"`, `model: "deepseek/deepseek-v4-flash:off"` (`worker`), `model: "deepseek/deepseek-v4-flash:xhigh"` (`workflow-validator`); feature dir as `cwd`, `inherit`, missing or divergent effective value invalidates dispatch, promotes no state. Execution done → persist `Status: done` in `manifest.md` and `plan.md`. **Never end asking the user to run the phase.**
9. Batches: spawn independents first, wait later; serialize only dependents. Parallel features → isolated worktrees.
10. Closing a batch: re-read each sub-feature's `manifest.md`/`plan.md`; update its line atomically to `manifest=done`, `execute=done`, `Verify=pass`, `Status=done` only when the **first `Status:` field** of both and `manifest.md > State > Plan` persist `done`, all tasks/phases `done`, resume points show no work, evidence approved. Before execution `manifest=ready`; after, mirror terminal header as `done`. Local approval never updates epic `Integration`, `Outcome Guardian`, `Status` or `Iterations used`.
11. While any `Sub-features` line is not `done | done | pass | done`, continue to the next released sub-feature in the DAG. Root Outcome Guardian stays `pending`; no phase-final response.
12. Only after gate items 1–2: merge worktrees when applicable, run end-to-end acceptance of the whole objective directly with `bash`/`read` from the root session, persist all proof and line/resume adjustments in `loop.md`. Never launch a child to run or approve E2E. Pass → no `subagent` call until `artifact-guardian`; fail → invalidate checkpoint, go to step 14.
13. After gate item 3 too: do `Pre-Guardian Checkpoint`, then fire root `artifact-guardian` with `model: "inherit"`, `context: "fresh"`, `cwd: "{canonical-project-root}"`, literal objective from `loop.md`, all sub-features and this iteration's `Integration > E2E` evidence.
14. **Gap → iterate:** integration/root outcome failure → diagnose smallest cause; before incrementing or reopening any state, apply `Ceiling` and `Anti-thrash`. No guard stops → record exactly one root iteration, fully apply `Root Correction Reopen`, then route to `batista-manifest`, `batista-execute` or decomposition. Root manager never fixes product; all product mutation stays in `batista-execute`'s `worker`.
15. Repeat until a `Stop Condition`. Update `loop.md` before yielding.
16. Conclude per `Final Response`.

### Resume Dispatch

| Persisted state | Next action |
|---|---|
| Open material clarification | `blocked`; ask user |
| Non-terminal sub-feature + manifest missing/invalid/not `ready` | load `batista-manifest/SKILL.md` inline |
| Valid manifest + `execute` `pending|running|fail` retry-eligible | load `batista-execute/SKILL.md` inline |
| `execute` `done` + verification pending | validate only that sub-feature, update its line |
| Sub-feature `done` but another incomplete | don't reopen the done one; continue next released, keep root outcome `pending` |
| All sub-features `done|done|pass|done` | run root end-to-end integration |
| Valid root integration + outcome `pending` | run root guardian |
| Root outcome rejected | record gap, open one root iteration |
| Root outcome approved for current evidence | `converged` |

### Root Completion Gate — fail-closed

Evaluate cumulatively: items 1–2 before root integration, 1–3 before Outcome Guardian, all before `converged`:

1. Every `Sub-features` line: `manifest=done`, `execute=done`, `Verify=pass`, `Status=done`, mirroring the first `Status:` of each `manifest.md`/`plan.md` and `manifest.md > State > Plan`; no incomplete task/phase or resume point.
2. No open blocker in the epic or sub-features.
3. `Integration > E2E` holds concrete, current proof of the whole objective on the paths defined from project root; no isolated phase proof; never reinterpret paths from the feature dir.
4. Outcome Guardian `approved` for `Artifact: {epic-dir}/loop.md` resolving exactly to the selected root loop, current `Iteration` and same `Evidence` as `Integration > E2E`.

Any missing/divergent/ambiguous field fails the gate. Incompatible Outcome Guardian → downgrade `pending`; optimistic `Status: converged` → downgrade `running`, continue via `Resume Dispatch`. Never treat spec/UX/Arch/plan/task/phase/`workflow-validator`/sub-feature approval as epic approval.

### Root Correction Reopen

After root failure, before any increment or reopen mutation, evaluate `Ceiling`/`Anti-thrash` with persisted budget and ledger. Guard fires → record stop condition; no increment/reopen. Else: downgrade Outcome Guardian `pending`, increment `Iterations used` once, record one concrete ledger entry. Fix fits an already-planned task → reopen **only** the responsible sub-feature before `batista-execute`:

- `plan.md`: first `Status: ready`; affected task/phase `pending`; `Evidence: pending`; resume points to the task; keep plan guardian/readiness `approved` (existing task doesn't change the plan);
- `manifest.md`: first `Status: ready`; `State > Plan: ready` — never `pending`; resume points to the task's `execute`; preserve all other states/guardians;
- loop line: `manifest=ready`, `execute=fail`, `Verify=pending`, `Status=running`.

Persist and re-read the whole transition **before** any correction; divergent field blocks the worker. Preserve unlisted fields; never rewrite the whole document to reopen statuses. Then, no shortcuts:

1. Preflight `list`/`get` for `worker` and `workflow-validator`;
2. `batista-execute`: checkpoint `running` → one worker → inspect write set/evidence;
3. child after that worker must be a single `workflow-validator`, never `artifact-guardian`; without positive approval the task doesn't close;
4. only then return task/phase, plan/manifest/`State.Plan`, resumes, loop line to terminal;
5. repeat root E2E, clean checkpoint, single `artifact-guardian`.

Rejected outcome/E2E → E2E `pass`, root guardian or `converged` jump is forbidden. Other sub-features stay terminal. Fix changes requirement/contract/solution/plan tasks → don't preserve approvals: invalidate downstream artifacts, route to `batista-manifest`/replan.

### Pre-Guardian Checkpoint

Persist `Integration > E2E`, lines, resume point first. Then, in a new tool round, re-read only `loop.md`, each full `manifest.md`/`plan.md` and evidence referenced by `Integration > E2E`; confirm gate items 1–3. Any `write`, `edit`, `bash` or child after those reads invalidates the checkpoint: mutate, repeat the whole reading round. Guardian must be the call immediately after the last `read` of a clean checkpoint.

## Decomposition

Decide by criteria, not convenience:

| Signal | Decision |
|---|---|
| Cohesive surface, small/medium, no independent increments | 1 feature (single manifest) |
| Independent surfaces, large, or increments that deliver/validate alone | N sub-features |
| Sub-feature B needs A's contract, or shares write set | sequential |
| Disjoint write sets + independent validation | parallel → 1 worktree per feature |

Same disjoint write-set rule as `batista-plan` (task parallelism), raised to feature level. Never parallelize features sharing file, migration, contract or validation sequence.

## Stop Conditions

Stop when (preference order):

- **Converged**: `Root Completion Gate` fully satisfied; whole objective approved by root Outcome Guardian.
- **Blocked**: product decision or external dependency blocks safe progress; record exact blocker, ask the user.
- **Ceiling**: after a new root failure, before opening another correction, `Iterations used` ≥ `Iteration budget` (default 5), or 3 consecutive iterations produced no new evidence; stop, report state, remaining gap, next action. Record `Status: ceiling` in `loop.md`.

Never iterate silently or declare `converged` without evidence. Each iteration must change something measurable in artifact or verifiable evidence.

### Anti-thrash

- Same `gap`+`cause` pair **2×** in Convergence Ledger → `Status: blocked` (no blind reexecution).
- Oscillation (e.g., `impl`→`integration`→`impl` on same gap) → `blocked` on 2nd lap.
- Iteration counts as progress only if ledger records new evidence (path, command, commit, test) distinct from previous.

### Iteration counting

- `Iterations used` belongs only to the root loop; starts `0`.
- Never increment on initial pass or for manifest, artifact, local guardian, sub-feature, batch, worker, validator, task or plan phase.
- After `Integration > E2E` failure or any root Outcome Guardian rejection (incl. premature metadata/status): check ceiling; with budget, increment exactly once before fixing or repeating the guardian.
- Each increment → one numbered Convergence Ledger entry with concrete `gap` and `cause`. `gap: none` lines are not iterations; must not exist.
- Initial pass converges → keep `Iterations used: 0` and `Convergence Ledger: - none`; no `0` entry, success summary or `gap: none`.
- On resume, reconcile `Iterations used` with those root entries before acting; task/phase-derived counts must be corrected, not preserved.

## Worktrees & Merge

- Parallel features with disjoint write sets → one isolated worktree each.
- Never let workers of different features write to the same working tree.
- After a parallel batch, merge worktrees in DAG order; resolve conflict as blocker (never overwrite a parallel change); only then run E2E integration.
- Integration fails → record gap, route fix to the right feature/layer; never fix inline.

## `loop.md` Template

```markdown
# {Objective} — Loop

Status: running | converged | blocked | ceiling
Created: {YYYY-MM-DD HH:MM}
Updated: {YYYY-MM-DD HH:MM}
Iteration budget: 5
Iterations used: {0}

## Objective

- Expected result: {what must be true at the end}
- Acceptance evidence: {observable proof at result level}

## Strategy

- Decomposition: single | decomposed(N)
- Execution: sequential | parallel
- Rationale: {why this strategy}

## Sub-features

| Feature | Dir | Batch | Depends on | Write set | Worktree | manifest | execute | Verify | Status |
|---|---|---|---|---|---|---|---|---|---|
| {name} | ./{dir} | {B#} | {features or none} | {paths} | {branch/path or none} | missing/running/ready/done/blocked | pending/running/done/fail | pending/pass/fail | pending/running/done/blocked |

## Convergence Ledger

- none (while `Iterations used: 0`)
- {iter >= 1} | gap: {concrete description} | cause: {spec/ux/arch/plan/impl/integration} | action: {replan/reexec/redecompose} | evidence: {ref} | result: {running/pass/fail/blocker}

## Integration

- Merge: {status/order}
- E2E: {cross-feature evidence or pending}

## Outcome Guardian

Status: pending | approved | rejected
Artifact: {epic-dir}/loop.md
Iteration: {Iterations used}
Evidence: {same reference as Integration > E2E}
- {finding/question/critique blocking the objective, or none}

## Resume Point

- Last completed sub-feature: {none}
- Next action: {action}
- Blockers: {none}
```

## Outcome Guardian

After gate items 1–3 and a clean `Pre-Guardian Checkpoint` in a previous round, run `artifact-guardian` via `subagent`: `model: "inherit"`, `context: "fresh"`, `cwd: "{canonical-project-root}"`, minimal context — epic's literal objective, `AGENTS.md`, `loop.md`, all sub-features' manifests/plans, produced root evidence. Fields literal; none omitted:

```text
subagent({ agent: "artifact-guardian", model: "inherit", context: "fresh", cwd: "{canonical-project-root}", task: "..." })
```

Guardian never edits files nor validates isolated task/phase/sub-feature (that's `batista-execute`'s). It validates the **end-to-end objective**: combined sub-feature result delivers the objective, integration/acceptance works, practical evidence — no guesswork. Any incomplete line or `Integration > E2E: pending` forces `rejected`, even single-feature.

Only this call's `DELEGATION_RESULT`, with `artifact` resolving to the selected root `loop.md` and evidence tied to current `Integration > E2E`, may update the root Outcome Guardian. In `evidence`, tie each objective criterion to `pass|fail` + checked proof; use `questions`, `blockers`, `resume` for decision, gap, smallest fix. Unprovable origin/scope keeps `pending`; `status: rejected` opens a root iteration.

## Rules

- Loop objective = result achieved with evidence, not docs written or code that "looks right".
- `/skill:batista-loop` authorizes authorship, execution, validation, iteration until a `Stop Condition`; never ask a second authorization between manifest and execute.
- Delegate authorship to `batista-manifest`, execution to `batista-execute`; never write `batista-spec`/`batista-ux`/`batista-arch`/`batista-plan` directly nor implement product.
- Every sub-feature goes through `batista-manifest` (authorship + guardians) before `batista-execute`.
- Parallel batches as batches: spawn first, wait later; one worktree per parallel feature; merge only afterwards.
- Never parallelize features sharing file, migration, contract or validation.
- Each iteration fixes the smallest point closing the gap; don't replan everything out of habit.
- Before replan, reexecution or merge, downgrade Outcome Guardian to `pending`; prior approval doesn't survive mutation/new evidence.
- Never declare `converged` with `Integration > E2E: pending`; single feature → record end-to-end acceptance evidence there.
- Hard blocker (product decision/external dependency) → stop and ask; don't invent answers.
- Respect `Iteration budget`; count only corrections opened by root failure per `Iteration counting`.
- Resume via dir or `loop.md`: same epic, start from resume point, revalidate state before acting.
- What survives the objective goes to the project (`AGENTS.md`, project-local skills, `docs/adr`); what dies with the feature stays in `.features/{...}/`.

## Checkpoint (mandatory)

Before **each** delegation to `batista-manifest`/`batista-execute`, merge or yielding, record in `loop.md`: `Updated:`, `Iterations used`, resume point, last Convergence Ledger line, Outcome Guardian. Never delegate with stale `loop.md`.

## State & Memory

- Source of truth is the file, not context. Write the delta to `loop.md` (and feature docs) before the next step (write-before-forget).
- Working context holds only: epic dir, current sub-feature/iteration, open blockers, next action. Rest is pointers (path + resume point), re-read on demand.
- Before yielding/compacting: real resume point and evidence in the file; collapse ledger to last 10 + rollup per sub-feature; discard `batista-manifest`/`batista-execute` transcripts (keep only {docs, evidence, gap}).
- Compact = project into a pointer, never invent. Summary never upgrades status. Divergence → file wins; re-read.

## Context Isolation

- Each delegation (`batista-manifest`/`batista-execute`/guardian) receives only objective/sub-feature, paths, feature dir, worktree, needed docs.
- Never use full session history as delegation context.
- `subagent` unavailable → follow `../../references/PI_ADAPTATION.md`: record blocker; never simulate authorship, guardian or execution inline.

## Final Response

Conclude with:

- `Objective`: verifiable objective and status (`converged` | `blocked` | `ceiling`).
- `Strategy`: decomposition, parallel/sequential batches and worktrees used.
- `Executed`: completed sub-features, replan/reexec iterations, merge/integration.
- `Evidence`: end-to-end result proof approved by the outcome guardian.
- `Pending`: blockers, open decisions or `none`.
- `Resume`: epic dir, resume point and next action.
