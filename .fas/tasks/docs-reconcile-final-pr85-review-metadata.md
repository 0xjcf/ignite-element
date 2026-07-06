# docs: reconcile final PR85 review metadata

## Source
Created with `fas create-task` on 2026-07-05.

## Problem
PR85 review metadata drifted from the docs-only scope: affected-file entries,
example install guidance, and task references needed to match the actual docs
and example files changed during closeout.

## Acceptance criteria
- The task packet scope matches the referenced docs/task files.
- The linked docs and task packets use the same example names, paths, and verification steps.
- The documentation-only metadata change is verified without requiring code-focused TDD or runtime coverage.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- .fas/tasks/test-examples-include-new-worked-apps-in-example-runtime-lan.md
- .fas/tasks/fix-snapshot-runtime-host-override-base-before-resolution.md
- docs/examples/README.md

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
