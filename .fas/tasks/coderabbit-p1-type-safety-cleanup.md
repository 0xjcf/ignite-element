# CodeRabbit P1 type safety cleanup

## Source
Created with `fas create-task` on 2026-05-28.

## Problem
Fix current CodeRabbit type-safety findings by replacing unnecessary or unsafe never casts in igniteCore/core surfaces and tightening shared Vite typing.

## Acceptance criteria
- Redux igniteCore source typing uses the intended union or narrowing instead of never.
- createIgniteComponentFactory propagates useful generics or validated types without erasing fields to never.
- XState factory and command metadata symbol casts are removed where inference is sufficient.
- Shared Vite fileName typing uses Rollup ModuleFormat or an equivalent precise type.
- Typecheck and focused compile tests pass.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-element/src/igniteCore/redux.ts
- packages/ignite-element/src/igniteCore/createIgniteComponentFactory.ts
- packages/ignite-element/src/igniteCore/xstate.ts
- packages/ignite-core/src/RenderArgs.ts
- configs/vite/lib.ts

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
