# CodeRabbit P0 adapter public API and runtime correctness

## Source
Created with `fas create-task` on 2026-05-28.

## Problem
Fix current CodeRabbit adapter findings: XState public exports, Redux slice-state extraction, MobX empty args handling, xstate matchState entrypoint coverage, and adapter UMD globals.

## Automation admission
- Expected operator value: Improves operator leverage around "CodeRabbit P0 adapter public API and runtime correctness" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- XState adapter factory/types and matchState public entrypoints are exported intentionally.
- Redux adapter returns and subscribes to slice state, not keyed root state.
- MobX adapter treats explicit empty args arrays as command args.
- Adapter UMD globals match external package globals.
- Add or update focused tests and run repo verification.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-adapters/src/index.ts
- packages/ignite-adapters/src/adapters/ReduxAdapter.ts
- packages/ignite-adapters/src/adapters/MobxAdapter.ts
- packages/ignite-adapters/vite.config.ts
- packages/ignite-element/src/tests/entrypoints.test.ts
- packages/ignite-element/src/tests/adapters/ReduxAdapter.test.ts
- packages/ignite-element/src/tests/adapters/MobxAdapter.test.ts
- packages/ignite-element/src/tests/IgniteCore.test.ts
- packages/ignite-adapters/src/utils/igniteRedux.ts
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- packages/ignite-element/src/examples/redux/src/js/reduxExample.tsx

## Scope Amendments
- Type: scope-refresh
- Added at: 2026-05-28
- Added paths: packages/ignite-element/src/tests/adapters/ReduxAdapter.test.ts, packages/ignite-element/src/tests/adapters/MobxAdapter.test.ts

- Type: scope-refresh
- Added at: 2026-05-28
- Added paths: packages/ignite-element/src/tests/IgniteCore.test.ts

- Type: scope-refresh
- Added at: 2026-05-28
- Added paths: packages/ignite-adapters/src/utils/igniteRedux.ts, packages/ignite-element/src/tests/types/igniteCore.types.test.ts

- Type: scope-refresh
- Added at: 2026-05-28
- Added paths: packages/ignite-element/src/examples/redux/src/js/reduxExample.tsx

- Type: scope-refresh-promotion
- Added at: 2026-05-28
- Trigger: dirty-low-confidence-scope
- Reason: Promoted dirty low-confidence or dependency-reachable task-packet path(s) into affected scope.
- Added paths: packages/ignite-adapters/src/index.ts
- Evidence source: task-packet dirty scope promotion
- Evidence: task-packet dirty scope promotion | .fas/state/task-packet.json | Promoted dirty path(s): packages/ignite-adapters/src/index.ts
- Accuracy signal: Path was dirty in git status and present in task-packet low-confidence/dependency-reachable scope.

## Implementation plan
- Convert the supplied context into a scoped implementation plan before editing.
- Refresh affected-file scope before implementation if the generated hints are incomplete.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Validate generated scope, acceptance criteria, and verification evidence before closeout to avoid workflow drift.

## Dependencies
- None known at task creation.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
