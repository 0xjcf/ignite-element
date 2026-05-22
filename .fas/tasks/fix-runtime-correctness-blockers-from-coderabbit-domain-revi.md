# fix runtime correctness blockers from CodeRabbit domain revi

## Source

Created with `fas create-task` on 2026-05-22.

## Problem

Group CodeRabbit critical/major runtime findings before broader cleanup: fix IgniteElement falsy-state rendering and internal state exposure, widen FacadeCommandFunction args, immediately notify ActorWebAdapter subscribers, remove non-browser SCSS stylesheet loading, align XState actor guard behavior with its interface, make renderer fallback warnings accurate, correct setGlobalStyles grammar/test expectation, and add task-manager bounds checks. Source: CodeRabbit domain reviews run against origin/main after commit 3a082b3.

## Automation admission

- Expected operator value: Improves operator leverage around "fix runtime correctness blockers from CodeRabbit domain review" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria

- Runtime behavior fixes are verified with focused regression tests for falsy current state, command args, ActorWeb subscriber notification, stylesheet path filtering, XState guard behavior, and task manager invalid indexes.
- Public API/internal visibility changes do not break existing package exports or downstream tests.
- Run pnpm run lint, pnpm run typecheck, pnpm test, and fas verify --full.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution

- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered

- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files

- packages/ignite-core/src/RenderArgs.ts
- packages/ignite-adapters/src/adapters/ActorWebAdapter.ts
- packages/ignite-adapters/src/utils/adapterGuards.ts
- packages/ignite-renderer/src/injectStyles.ts
- packages/ignite-renderer/src/renderers/registry.ts
- packages/ignite-renderer/src/globalStyles.ts
- packages/ignite-element/src/IgniteElement.ts
- packages/ignite-element/src/examples/xstate/taskManagerMachine.ts
- packages/ignite-element/src/tests/globalStyles.test.ts

## Scope Amendments

- None.

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
