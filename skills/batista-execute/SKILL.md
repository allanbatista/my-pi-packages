---
name: batista-execute
description: Orchestrates feature execution from `manifest.md`, `spec.md` and `plan.md`, delegating implementation to subagents and validation to an independent subagent. Use `/skill:batista-execute` when the user requests execution, resumption, task/phase coordination, operational parallelism, or independent workflow validation.
---

# Feature Execute

## Runtime & Delegation

Follow `../../references/WORKFLOW_COMMON.md` (Pi runtime, delegation, isolation, state reconciliation, checkpoints).

This session becomes the execution manager: coordinates, records progress, delegates; never implements code nor validates its own implementation. The manager edits feature workflow docs only; product code, tests, configs, and migrations are editable only by a child **worker** launched via `Agent` (interface real: `../../references/PI_ADAPTATION.md`).

### Write Boundary — fail-closed

Manager `write`/`edit` allowlist: selected `loop.md`, `manifest.md`, `plan.md` only. Every other path is the worker's (trivial files, tests, configs, copies, renames, path fixes). On wrong write or incomplete change: record the rejection, launch a correction worker; the manager never moves, copies, recreates, or fixes product files.

No guessing: investigate before delegating or concluding; demand concrete evidence from workers/validators; record a blocker for any premise unconfirmable via file, command, log, test, browser, or user answer. "Done" = practical validation with working evidence on the affected path, not "the code looks right".

Workers/validators get minimal context only (see Context Isolation). Apply `../../references/MODEL_POLICY.md`: worker `deepseek/deepseek-v4-flash:off`; `workflow-validator` `deepseek/deepseek-v4-flash:xhigh`.

## Workflow

1. Read `AGENTS.md`; apply the agents preflight from `../../references/WORKFLOW_COMMON.md`; confirm builtin `worker` and the package's `workflow-validator` with the exact read-only allowlist.
2. Canonicalize project root, feature dir, write sets per `../../references/WORKFLOW_COMMON.md`. Input resolving to an existing feature dir/file → select and re-read state; never create another feature.
3. Reconcile `manifest.md`, `spec.md`, `plan.md`, relevant `ux.md`/`arch.md` slices. Execute only with manifest/spec/plan `ready`, mandatory guardians `approved`, gates `[x]`, zero material questions, runnable task. Root fix of an existing task: eligible only after full `Root Correction Reopen` transition; partial `done` is not runnable.
4. Authorship divergence/gap → persist `blocked`, return to `batista-manifest`; never fix leaf artifacts nor execute by assumption.
5. Resuming a `running` task: verify owner, diff, persisted evidence before relaunch; do not duplicate applied work.
6. Capture worktree baseline; update `manifest.md`/`plan.md`: task/phase `running`, owner, write set, resume point, required evidence.
7. Launch **worker** via `Agent({ subagent_type: "worker", prompt, description })` (interface real e regras em `../../references/PI_ADAPTATION.md`; modelo/thinking pinados no frontmatter do papel), closed scope: task, write set, DoD, practical evidence, relevant slices, permitted focused tests. O child herda o cwd da sessão raiz — manager deve estar no project root, nunca no feature dir.
8. Parallel batch = dois ou mais `Agent` com `run_in_background: true` e write sets disjuntos apenas; start all before awaiting, depois `get_subagent_result({ agent_id, wait: true })`.
9. After each synchronous worker: compare actual diff vs baseline/write set; persist files, commands, results, evidence. `(no output)` or missing envelope is **neither failure nor retry authorization** — inspect write set/evidence, proceed to validator if the result exists. Never `get_subagent_result` by agent name (async runs with real IDs only). Child reports never promote status.
10. Launch **exactly one workflow-validator per task/attempt** via `Agent({ subagent_type: "workflow-validator", ... })`, real artifacts/evidence. Await and consume its return; never duplicate it in a batch nor relaunch just to change `output`. It inspects persisted evidence read-only. Absence of rejection is insufficient: require explicit positive approval per `WORKFLOW_COMMON`; `pending`, `blocked`, silent, or ambiguous returns do not promote the task.
11. Rejection or diff/write-set/path divergence → record cause, delegate the minimal fix to a new worker. Never fix directly (not one line, not a move/copy); same cause repeated without new evidence becomes a blocker.
12. Phase close: delegate the plan's final gate to the worker; no full suites per task out of habit.
13. Mark `done` only after validator `approved`. All phases and evidence approved → close state atomically before returning control: `Status:` of `plan.md` and `manifest.md` to `done`, `manifest.md > State > Plan: done`, resume points with no next task, all tasks/phases `done`; re-read both — any divergence keeps execution `running`.
14. Loaded by `batista-loop` → emit no `Final Response`; return control to the loop in the same turn. Standalone → respond per `Final Response`.

## Manager Boundaries

- May edit `manifest.md`/`plan.md` (status, blockers, evidence, loop ledger, resume point).
- May ask the user for clarification when a decision blocks safe execution.
- May not implement code, fix tests, alter product files, or deem its own validation sufficient.
- No `Agent` tool → follow `../../references/PI_ADAPTATION.md`: block; never simulate worker/validator inline.

## Delegation Prompts

Implementation worker:

```text
You are the worker responsible for this task/phase only.
Read AGENTS.md, spec.md, plan.md, and the relevant arch.md/ux.md slice.
Scope: {task/fase}
Parallel batch: {batch-id | sequential}
Files/responsibility: {write set}
DoD: {DoD}
Required practical evidence: {required evidence}
Allowed automated tests: only tests focused on this task's changes, unless the plan explicitly requires more.
Do not revert other agents' changes; adapt to parallel edits.
Implement the smallest safe diff.
Return `DELEGATION_RESULT` with a structured delta: files_changed, commands_run (exit code), evidence_produced, follow_ups/blockers.
If a recipe repeats (>=2-3 times), flag it as a project-skill candidate in follow_ups.
```

Validation worker:

```text
You are the independent validator of this task/phase.
Model: deepseek/deepseek-v4-flash:xhigh.
Read AGENTS.md, spec.md, plan.md, and the worker result.
Do not implement fixes; do not run commands or tests (worker or phase gate owns them).
Check the executable/observable evidence already produced: browser, API, consumer, logs, manual smoke, commands with outputs, artifacts.
Reject code-reading-only, generic evidence, or tests without proof of the affected behavior.
Verify alignment with requirements, DoD, expected files, practical evidence, and obvious regressions.
Return only `DELEGATION_RESULT` with approved/rejected, evidence checked, and minimal fix.
```

## Rules

- Every implementation via worker; every acceptance via separate validator.
- Worker and validator follow `../../references/MODEL_POLICY.md` (models/effort distinct from planning).
- Both are separate `Agent` children with contexto mínimo (frontmatter `prompt_mode: replace` + `skills: false`; sem `inherit_context`); never full manager history.
- Parallel batches: spawn first, wait after; never serialize independent tasks.
- Workers may run focused automated tests; full suites only at phase gate or explicit requirement.
- Validators never run automated tests; they check practical evidence and block weak delivery.
- Reject generic reports; require changed files, executed commands, results, verifiable working evidence.
- Manager records, coordinates, decides next step; never judges implementation correctness alone.
- No parallelism for tasks sharing files, state, migration, contract, or validation sequence.
- Never mark `done` with a blocker, open question, missing or `pending` evidence, failing test, or missing independent validation.
- On resume: start at manifest/plan resume point; revalidate state before delegating.

## Skill Extraction

Repeatable tasks become project skills, not re-executed boilerplate.

- Trigger: same recipe (step/command/validation sequence) ≥ 2–3 times within or across features (workers flag candidates in `follow_ups`); record in loop ledger/`plan.md`.
- Action: delegate to a `worker` the creation of `{project}/skills/{skill-name}/`, then `workflow-validator`; later tasks use the skill instead of re-deriving.
- Runs **only** on the main worktree, **after** merge, **one extraction at a time** — never parallel with sub-feature worktrees or another extraction. Exclusive write set: `{project}/skills/{skill-name}/`.
- Guardrail (skill YAGNI): one-offs never become skills; extract only with real repetition and a stable procedure.

## Checkpoint (mandatory)

Before **every** worker/validator spawn or yielding the turn, record in `plan.md`/`manifest.md`: task/phase `running` or result, resume point, blockers. Never spawn with a stale resume point.

## State & Memory

- The file is the source of truth, not context. Write the delta (status, evidence, resume point) into `plan.md`/`manifest.md` before releasing the next batch (write-before-forget).
- Manager context holds only: feature dir, current batch/task, open blockers, next action. Worker/validator transcripts become file deltas {files, commands, evidence} and leave context.
- Before yielding or compacting: ensure real resume point and evidence; collapse long ledgers to last 10 + rollup. Compacting projects into pointers, never invents; summaries never upgrade status; on divergence the file wins.
- Learnings flush on feature close: promote durable items (conventions, architecture decisions, procedures turned skills) to the project (`AGENTS.md`, project-local skills, `docs/adr`); ephemeral items die with `.features/{...}/`.

## Context Isolation

- Pass to each delegation only: task/phase, paths, write set, DoD, required evidence, `arch.md`/`ux.md` slice, feature docs.
- Never pass full conversations, prior reasoning, or context unreferenced in the docs.
- Subagent needing extra context → record the missing artifact and send only that artifact.

## Final Response

On completion, respond with:

- `Executed`: completed tasks/phases, parallel batches run, workers used, files changed, approved evidence.
- `Failed`: rejected tasks/phases, cause, evidence, next fix.
- `Pending`: blockers, open decisions, missing validations, or `none`.
- `How to validate`: commands/checks the user can run and expected result.
- `Final summary`: feature status, resume point, next action.

When loaded by `batista-loop`, skip this human response; continue the controller with persisted state.
