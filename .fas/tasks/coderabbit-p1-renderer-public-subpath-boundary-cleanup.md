# CodeRabbit P1 renderer public subpath boundary cleanup

## Source
Created with `fas create-task` on 2026-05-28.

## Problem
Fix current CodeRabbit renderer boundary findings by replacing deep relative re-exports from ignite-element into ignite-renderer internals with stable package subpath exports, adding renderer package exports if needed.

## Acceptance criteria
- ignite-element JSX runtime re-exports use package subpaths, not ignite-renderer source-relative paths.
- There is one canonical JSX renderer public export surface without redundant deep internals.
- ignite-renderer exports any required subpaths intentionally with matching types.
- Typecheck and package export tests or entrypoint tests cover the boundary.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-element/src/renderers/jsx/jsx-runtime.ts
- packages/ignite-element/src/renderers/jsx/index.ts
- packages/ignite-element/src/renderers/jsx/IgniteJsxRenderStrategy.ts
- packages/ignite-renderer/package.json

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
