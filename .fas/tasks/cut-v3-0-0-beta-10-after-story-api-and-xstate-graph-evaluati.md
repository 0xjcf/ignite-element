# Cut v3.0.0-beta.10 after Story API and XState graph evaluation

## Source
Created with `fas create-task` on 2026-07-20.

## Problem
Operator-owned prerelease checkpoint for the four fixed packages after the behavior-evidenced, adapter-neutral Story API cutover and optional XState graph evaluation. Published from beta using the repository release wrapper; reconcile the successful dry-run, npm publication, dist-tags, release commit, and annotated remote tags.

## Acceptance criteria
- The inert beta release preview exits successfully and plans all four packages at 3.0.0-beta.10
- npm reports beta dist-tags at 3.0.0-beta.10 for all four packages
- ignite-element latest remains 2.2.2 while v3 remains prerelease
- Release commit 1115283b and four annotated package tags are present on origin/beta
- The operator completion record captures the release receipts and the executable-narratives epic includes the beta release member
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- .fas/TASKS.md
- .fas/queue/tasks.json
- .fas/tasks/cut-v3-0-0-beta-10-after-story-api-and-xstate-graph-evaluati.md

## Scope Amendments
- Type: scope-refresh
- Added at: 2026-07-20
- Added paths: .fas/TASKS.md, .fas/queue/tasks.json, .fas/tasks/cut-v3-0-0-beta-10-after-story-api-and-xstate-graph-evaluati.md

## Implementation plan
- Verify the completed dry-run, npm dist-tags, release commit, remote tags, and clean synchronized beta branch
- Create the missing beta.10 queue record under the executable-narratives epic with the actual predecessor edges
- Complete the task through the operator path and synchronize the human tracker

## Verification plan
- Read the completed queue row and operator evidence from .fas/queue/tasks.json
- Confirm the executable-narratives epic contains the beta-release member
- Confirm .fas/TASKS.md records the task as done
- Run the FAS verification lane for the tracking-only change

## Risks
- Validate generated scope, acceptance criteria, and verification evidence before closeout to avoid workflow drift.

## Dependencies
- Depends on task-1784562435054 (Story API beta cutover)
- Depends on task-1784171502136 (optional XState graph evaluation)

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
