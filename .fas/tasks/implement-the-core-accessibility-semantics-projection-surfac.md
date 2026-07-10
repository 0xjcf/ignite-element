# Superseded: projection registry, behavior metadata, and native JSX guardrails

## Source
Created with `fas create-task` on 2026-07-09.

## Status
Superseded before implementation by `task-1783650880370`. This brief is retained
only as an audit record of the rejected registry and presentation-metadata
direction; it is not implementation guidance.

## Acceptance criteria
- No source implementation is authorized from this brief.
- New implementation work follows `task-1783650880370` and its replacement
  brief, `.fas/tasks/implement-internal-dynamic-projection-pipeline-and-llm-autho.md`.
- The rejected registry and presentation-metadata proposal remains historical
  context only.

## Proposed solution
- None. See the replacement task for the accepted architecture and execution plan.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
None. No implementation was started from this superseded brief.

## Scope Amendments
- Type: superseded-before-implementation
- Added at: 2026-07-09
- Trigger: The provisional implementation demonstrated that registry/config integration and behavior presentation metadata would spread through every igniteCore adapter, factory, schema, and entrypoint.
- Reason: The user rejected that API direction. All uncommitted source changes were restored, and queue task task-1783610917796 was superseded by task-1783650880370.
- Evidence source: architecture discussion and clean-tree restoration
- Evidence path: `.fas/tasks/implement-internal-dynamic-projection-pipeline-and-llm-autho.md`
- Accuracy signal: high
- Follow-up: Keep this brief for audit history only; do not use it for implementation guidance.

## Implementation plan
Do not implement this brief. Follow the replacement task.

## Verification plan
No verification is required for this historical brief.

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
