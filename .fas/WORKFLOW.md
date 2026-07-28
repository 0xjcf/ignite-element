# Development Workflow

## Pipeline Summary

| Stage | Script | Status | Owner | Description |
| ----- | ------ | ------ | ----- | ----------- |
| memory review | (inside planner) | — | — | Read `.fas/memory/*` for durable constraints and past incidents |
| repo index search | `index-repo.sh` | — | — | Build structural file map, symbols, and dependency graph |
| semantic search | `semantic-index.sh` / `semantic-query.sh` | — | — | Chunk codebase and query by meaning |
| behavior guardian | `architect-check.sh` | — | — | Validate plan against architecture boundaries |
| planner | `planner.sh` | `planning` → `commit-planning` | `planner` | Generate plan with mode, phase, agent orchestration strategy, commit plan, and constraints |
| commit plan | `plan-commits.sh` | `commit-planning` → `implementing` | `implementer` | Break the approved plan into ordered incremental commit steps |
| implementation | `execute-commits.sh` | `implementing` → `verifying` | `verifier` | Execute each commit step with per-step verification |
| spike | (within commit plan) | `spike` | `investigator` | Cross-repo exploration, pattern validation, and scoped task brief creation. Briefs targeting sibling repos are written to that repo's `.fas/tasks/`. |
| debug | (within commit plan) | `debug` | `investigator` | Investigate root cause, gather traces, record incident, create follow-up task |
| code-review | (within commit plan) | `code-review` | `reviewer` | Review external PR for correctness, risk, and test coverage; produce recommendation |
| validation | (within commit plan) | `validation` | `validator` | Capture evidence, screenshots, and QA results |
| closeout | (within commit plan) | `closeout` | `documenter` | Update docs, record residual issues, finalize tracking |
| verification | `verify.sh` | — | — | Run non-mutating lint, format checks, typecheck, tests, architecture drift, and boundary checks |
| review | `reviewer.sh` | `verifying` → `review` | `reviewer` | Generate review summary with compliance checklist |
| draft PR | `create-pr.sh` | `review` → `done` | `reviewer` | Create draft PR for human review |

Notes:

- `verify.sh` does not trigger a status transition. It is a utility called per-step during implementation and standalone during the verification stage.
- `verify.sh` must never rewrite files. Use `fix.sh` or `fas fix` for explicit autofix flows.
- Spike, debug, code-review, validation, and closeout are handled within the commit plan when the task `phase` is set accordingly. They do not have dedicated scripts.
- `planner.sh` selects `mode` and `phase`, then derives `agentOrchestration.strategy` for interactive sessions (Cursor, Codex, Claude Code). It also writes `.fas/state/agent-orchestration.json` and `.fas/state/agent-orchestration-prompt.md`.
- `plan-commits.sh` does not choose workflow mode, task phase, or agent orchestration strategy. It only turns the approved plan into ordered commit steps.
- Status transitions are performed by `fas_transition_task` which updates both `current-task.json` and `TASKS.md` atomically.

## Delegated Checkpoints

- Treat stale-running delegated diagnostics as advisory only. They help the root session notice a stall but do not auto-close or auto-fail an agent.
- Before replacing a stalled delegated step, request an interrupting checkpoint first. Same-actor resume is the default retry path; replacement is the exception. If the agent can still respond, require a partial-state handoff with files touched, verification attempted, blockers, and the next safe resume point.
- At the watchdog warning window, request the interrupting checkpoint and wait through the recorded grace deadline. Warning plus no first diff is supporting context only, never enough to replace a code-writing delegate by itself.
- If the watchdog timeout window arrives with no pending checkpoint, request an urgent interrupting checkpoint first and record its grace deadline before replacement or root takeover.
- For same-actor retry resume, reissue `fas spawn-subagent <step-key> --json` without `--session-id`; FAS reuses the step's prior session id when one exists. Pass an explicit new `--session-id` only for replacement or root takeover.
- When recording a retry `started` event, attach `--retry-context <json>` using `kind` (`resume-original`, `replacement`, or `root-takeover`) plus fields such as `failedCommand`, `failureClass`, `filesTouched`, `verificationAttempted`, `nextSafeResumePoint`, and `downstreamReconfirmationNeed` so retry evidence is durable on the append-only execution log. Do not use a legacy `continuity` key. For `replacement` or `root-takeover`, keep `replacementReason` explicit; for failed-checkpoint replacement or root takeover, also include `checkpointAudit` plus `partialStateInspectedAt`.
- Code-writing delegated agents should send an early orientation heartbeat after reading the task packet and commit plan, then send that same partial-state handoff before a long verification run or whenever they hit a blocker that will delay completion.
- If the checkpoint request fails, inspect any partial edits or verification receipts that already exist, then record `failed` before root takeover or delegated reissue. Use replacement or root takeover only after failed interrupting checkpoint after grace, missing or unusable handoff, scope drift, repeated bad fixes, context poisoning, or explicit takeover. Use `closed` only when intentionally abandoning a still-running non-failed step if the state machine supports that path.

## Status vs Phase

- **`status`** tracks pipeline progress — where the task is right now (e.g., `implementing`, `verifying`, `review`, `done`).
- **`phase`** is a task-type classifier set once at creation — `spike`, `debug`, `code-review`, `implementation`, `validation`, or `closeout`. It determines which commit plan template the planner generates.
- **`agentOrchestration.strategy`** is derived by the planner from `mode` and `phase`. It selects the interactive subagent recipe (for Cursor, Codex, or Claude Code) without changing the underlying FAS task taxonomy.

## Setup Prerequisite

Run `fas setup` once after `fas install` and before any `fas implement` or `fas create-task`. Setup seeds memory, configures behavior boundaries, populates workspace dependencies, and builds indexes. Without it, the planner operates with degraded context.

`fas install` scaffolds a `behaviorBoundaries` block in `.fas-config.json`, but the defaults are only a starting shape. Use `fas setup` or `fas prompt configure-boundaries` to confirm the real path prefixes and choose the enforcement scope intentionally.

`fas implement` auto-detects and fixes common setup gaps (empty memory, missing boundaries, missing indexes) but cannot replace the interactive review that `fas setup` provides. For spikes, `spike-bootstrap-sibling.sh` runs the non-interactive seed scripts (`seed-memory.sh`, `seed-boundaries.sh`, `seed-architecture-rules.sh`, `seed-workspace-deps.sh`) on each sibling repo automatically.

## Core Rules

- Run `fas setup` before creating tasks.
- Start from `TASKS.md`.
- Read task-packet contextual memory first, then expected change and ChangeSet evidence, before falling back to raw `.fas/memory/*`.
- Use structural and semantic search before editing.
- Run Behavior Guardian checks before finalizing the plan and again during verification.
- Keep spike, debug, code-review, validation, and closeout free of implementation changes.
- Keep screenshots under `.fas/artifacts/screenshots/` and out of Git by default.
- Continue autonomously until draft PR handoff or a hard blocker.
- Handoffs must cite changed files, ChangeSet or planAlignment evidence, verification receipts, and any memory constraints used or intentionally overridden.

## Verification

Use the platform verification pipeline through `fas verify` or the local wrapper scripts generated from the platform.
