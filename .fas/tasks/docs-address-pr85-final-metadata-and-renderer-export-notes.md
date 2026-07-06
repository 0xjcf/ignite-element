# docs: address PR85 final metadata and renderer export notes

## Source
Created with `fas create-task` on 2026-07-06.

## Problem
CodeRabbit flagged two final PR85 notes: one FAS task brief still used a
placeholder Problem section, and the exported `mountIgniteJsxOnce` helper was
still marked `@internal` even though `igniteShell` now imports it through the
public renderer JSX entrypoint.

## Acceptance criteria
- `mountIgniteJsxOnce` remains exported with the same function name and signature.
- The public JSX helper JSDoc no longer marks the export as internal.
- The related FAS task metadata describes the concrete runtime review issue.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- .fas/tasks/fix-address-final-pr85-runtime-review-findings.md
- packages/ignite-renderer/src/renderers/jsx/IgniteJsxRenderStrategy.ts

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
