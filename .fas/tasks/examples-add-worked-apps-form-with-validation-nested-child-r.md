# examples: add worked apps (form-with-validation, nested/child-router, dashboard-with-shared-state)

## Source
Created with `fas create-task` on 2026-06-18.

## Problem
Remaining worked-app examples. form-with-validation shipped as a focused task (queue task-1781962208694; examples/apps/form-with-validation; XState + ignite-JSX; done 2026-06-20). Still to do under examples/apps: (1) a nested/child-router example building on spa-router, and (2) dashboard-with-shared-state. Each minimal and headless-testable, reusing the vite + source-alias scaffolding; wire into docs as proof points.


## Acceptance criteria
- The new functionality works as described.
- Existing behavior is not broken.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- package.json
- docs/examples/README.md
- docs/site/src/content/docs/guides/routing.mdx
- examples/apps/dashboard-with-shared-state/README.md
- examples/apps/dashboard-with-shared-state/index.html
- examples/apps/dashboard-with-shared-state/package.json
- examples/apps/dashboard-with-shared-state/pnpm-lock.yaml
- examples/apps/dashboard-with-shared-state/src/dashboard.css
- examples/apps/dashboard-with-shared-state/src/dashboard.dom.test.tsx
- examples/apps/dashboard-with-shared-state/src/dashboard.headless.test.ts
- examples/apps/dashboard-with-shared-state/src/dashboard.tsx
- examples/apps/dashboard-with-shared-state/src/dashboardModel.test.ts
- examples/apps/dashboard-with-shared-state/src/dashboardModel.ts
- examples/apps/dashboard-with-shared-state/src/dashboardStore.ts
- examples/apps/dashboard-with-shared-state/src/env.d.ts
- examples/apps/dashboard-with-shared-state/tsconfig.json
- examples/apps/dashboard-with-shared-state/vite.config.ts
- examples/apps/nested-child-router/README.md
- examples/apps/nested-child-router/index.html
- examples/apps/nested-child-router/package.json
- examples/apps/nested-child-router/pnpm-lock.yaml
- examples/apps/nested-child-router/src/env.d.ts
- examples/apps/nested-child-router/src/router.headless.test.ts
- examples/apps/nested-child-router/src/router.tsx
- examples/apps/nested-child-router/src/routerMachine.test.ts
- examples/apps/nested-child-router/src/routerMachine.ts
- examples/apps/nested-child-router/src/routerStore.ts
- examples/apps/nested-child-router/styles.css
- examples/apps/nested-child-router/tsconfig.json
- examples/apps/nested-child-router/vite.config.ts

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
