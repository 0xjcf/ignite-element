# Examples: pin the spa-router example's xstate to the workspa

## Source
Created with `fas create-task` on 2026-06-17.

## Problem
Examples: pin the spa-router example's xstate to the workspace version so installing example deps doesn't break the monorepo typecheck. Running 'npm install' in packages/ignite-element/src/examples/spa-router (e.g. to launch the Vite preview) pulls a newer xstate than the workspace pins (observed 5.32.1); 'tsc --project src/examples/spa-router/tsconfig.json' then fails with 'Property getPreInitialState is missing in type StateMachine<...>' — a dual-xstate type skew between the example's machine and ignite's AnyStateMachine. Fix: pin the example's xstate dependency to the exact workspace version (or otherwise ensure the example typecheck resolves xstate from the workspace). Audit the other examples (xstate/redux/mobx) for the same drift and pin them too. Related class: the goodway 'getInitialSnapshot is not a function' spike.

## Acceptance criteria
- The defect no longer reproduces.
- A regression test covers the fix.
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
- packages/ignite-element/src/examples/spa-router/package.json
- packages/ignite-element/src/examples/xstate/package.json

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
