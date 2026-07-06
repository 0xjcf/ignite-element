# docs: align PR85 docs metadata acceptance criteria

## Source
Created with `fas create-task` on 2026-07-06.

## Problem
The docs reconciliation task used code-change acceptance criteria even though
its scope was limited to FAS docs/task metadata. This task narrows those
criteria so the packet describes docs-only validation instead of runtime TDD.

## Acceptance criteria
- The affected task metadata uses docs-only acceptance criteria.
- The task packet scope stays limited to FAS docs/task metadata.
- The documentation-only metadata change is verified without requiring code-focused TDD or runtime coverage.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- .fas/tasks/docs-reconcile-final-pr85-review-metadata.md

## Scope Amendments
- None.

## Implementation plan
- Convert the supplied context into a scoped implementation plan before editing.
- Refresh affected-file scope before implementation if the generated hints are incomplete.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.

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
