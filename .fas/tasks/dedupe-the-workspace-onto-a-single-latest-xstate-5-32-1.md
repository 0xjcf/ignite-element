# Dedupe the workspace onto a single, latest xstate (5.32.1). 

## Source
Created with `fas create-task` on 2026-06-17.

## Problem
Dedupe the workspace onto a single, latest xstate (5.32.1). Today ignite-adapters resolves xstate 5.25.0 while ignite-element resolves 5.30.0 — two copies in one workspace. That split is why the examples had to pin to 5.25.0 (the adapter-source copy the example typecheck resolves through); it is fragile and will rot when either side drifts. Converge everything on the latest xstate: bump the xstate devDependency in packages/ignite-element/package.json and packages/ignite-adapters/package.json to ^5.32.1, re-pin the two xstate examples (packages/ignite-element/src/examples/spa-router/package.json and .../examples/xstate/package.json) from 5.25.0 to 5.32.1, and run 'pnpm install' so pnpm-lock.yaml dedupes to one xstate copy. Keep the peer-dependency range (>=5.19.0) as-is. Verify: (1) '.fas/scripts/verify.sh --full' green on 5.32.1 (xstate 5.x evolved 5.25->5.32, so ignite-adapters source/types/tests must still pass); (2) installing an example in-place (npm install in spa-router) then 'tsc --project src/examples/spa-router/tsconfig.json' is clean (no getPreInitialState skew), confirming the dedupe removes the dual-copy issue. Affected files: packages/ignite-element/package.json, packages/ignite-adapters/package.json, packages/ignite-element/src/examples/spa-router/package.json, packages/ignite-element/src/examples/xstate/package.json, pnpm-lock.yaml.

## Acceptance criteria
- External behavior is unchanged.
- The refactored code meets the stated goal.
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
- Scope unknown.

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
