# docs: tighten PR85 docs-only task metadata

## Source
Created with `fas create-task` on 2026-07-06.

## Problem
CodeRabbit flagged two docs-only PR85 task briefs whose Problem sections still
repeated their titles and whose verification plans referenced the full
release-quality gate. This task makes those metadata packets concrete and keeps
their verification guidance scoped to `fas validate-task`.

## Acceptance criteria
- The affected docs-only task briefs describe the concrete metadata mismatch.
- The affected docs-only verification plans reference `fas validate-task` only.
- The task packet scope stays limited to FAS docs/task metadata.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- .fas/tasks/docs-reconcile-final-pr85-review-metadata.md
- .fas/tasks/docs-align-pr85-docs-metadata-acceptance-criteria.md

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
