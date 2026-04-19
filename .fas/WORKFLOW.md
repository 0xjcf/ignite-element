# Development Workflow

## Pipeline Summary

| Stage | Script | Status | Owner | Description |
| ----- | ------ | ------ | ----- | ----------- |
| memory review | (inside planner) | — | — | Read `.fas/memory/*` for durable constraints and past incidents |
| repo index search | `index-repo.sh` | — | — | Build structural file map, symbols, and dependency graph |
| semantic search | `semantic-index.sh` / `semantic-query.sh` | — | — | Chunk codebase and query by meaning |
| behavior guardian | `architect-check.sh` | — | — | Validate plan against architecture boundaries |
| planner | `planner.sh` | `planning` → `commit-planning` | `planner` | Generate plan with mode, phase, commit plan, and constraints |
| commit plan | `plan-commits.sh` | `commit-planning` → `implementing` | `implementer` | Break plan into ordered incremental commit steps |
| implementation | `execute-commits.sh` | `implementing` → `verifying` | `verifier` | Execute each commit step with per-step verification |
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
- Debug, code-review, validation, and closeout are handled within the commit plan when the task `phase` is set to `debug`, `code-review`, `validation`, or `closeout`. They do not have dedicated scripts.
- Status transitions are performed by `fas_transition_task` which updates both `current-task.json` and `TASKS.md` atomically.
- In Codex interactive runs, use `.fas/state/codex-orchestration.json` and `.fas/state/codex-subagents-prompt.md` as the authoritative subagent recipe. Treat the task packet, planning output, and commit plan as the source of truth over generic skill defaults.

## Status vs Phase

- **`status`** tracks pipeline progress — where the task is right now (e.g., `implementing`, `verifying`, `review`, `done`).
- **`phase`** is a task-type classifier set once at creation — `debug`, `code-review`, `implementation`, `validation`, or `closeout`. It determines which commit plan template the planner generates.

## Core Rules

- Start from `TASKS.md`.
- Read `.fas/memory/*` before repo indexing.
- Use structural and semantic search before editing.
- Run Behavior Guardian checks before finalizing the plan and again during verification.
- Keep debug, code-review, validation, and closeout free of implementation changes.
- Keep screenshots under `.fas/artifacts/screenshots/` and out of Git by default.
- Continue autonomously until draft PR handoff or a hard blocker.

## Verification

Use the platform verification pipeline through `fas verify` or the local wrapper scripts generated from the platform.

## Codex 6-Agent

- Planner consultation happens in the root session before delegated execution begins.
- Follow the generated order in `.fas/state/codex-orchestration.json`.
- Only the declared code-writing role may modify source files.
- Use Codex subagents for architecture, staff-engineering, QA, SRE, and reviewer passes instead of the heavy runtime-oriented FAS subagent CLI loop unless provenance receipts are explicitly needed.
