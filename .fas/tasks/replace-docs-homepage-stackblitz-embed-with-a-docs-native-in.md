# Replace docs homepage StackBlitz embed with a docs-native interactive counter demo (keep StackBlitz/repo links as plain links); fixes the 'Unable to run Embedded Project' isolation-header failure on GitHub Pages

## Source
Updated with `fas edit-task` on 2026-06-12.

## Problem
Replace docs homepage StackBlitz embed with a docs-native interactive counter demo (keep StackBlitz/repo links as plain links); fixes the 'Unable to run Embedded Project' isolation-header failure on GitHub Pages

## Acceptance criteria
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Scope Amendments
- Type: formatting-only
- Added at: 2026-06-12
- Trigger: verify.sh format gate failure
- Reason: Pre-existing Biome format failure in changesets-generated pre.json (written by release commit dca2ace) blocks the whole-repo format gate; formatting-only unblock, no semantic change
- Added paths: .changeset/pre.json
- Evidence: .fas/state/verification/latest.log

## Implementation plan
- Describe the intended code or workflow changes in execution order.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Note any regression, rollout, or coordination risk before implementation begins.

## Dependencies
- List blocking tasks, PRs, docs, or external inputs.

## Open questions
- Capture unresolved decisions that need confirmation before closeout.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`

## Affected files
- .changeset/pre.json
