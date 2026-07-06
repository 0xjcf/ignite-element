# fix: guard deferred shared cleanup release

## Source
Created with `fas create-task` on 2026-07-06.

## Problem
CodeRabbit found that deferred shared cleanup can still throw through
`releaseRuntimeAccess()`: when a shared DOM bridge or watcher holds runtime
access, the last element disconnect marks cleanup pending, and the later
unsubscribe/stop path releases runtime access, `releaseSharedResources()` can
throw and escape the unsubscribe flow.

## Acceptance criteria
- The defect no longer reproduces.
- A regression test covers the fix.
- Deferred shared cleanup triggered by runtime-access release logs cleanup
  failures instead of throwing through unsubscribe/stop.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-element/src/IgniteElementFactory.ts
- packages/ignite-element/src/tests/IgniteElementFactory.test.ts
- packages/ignite-element/src/testing.ts

## Scope Amendments
- Include `packages/ignite-element/src/testing.ts` for a formatter-only import
  ordering residue left by the previous full verification gate.

- Type: scope-refresh-promotion
- Added at: 2026-07-06
- Trigger: dirty-low-confidence-scope
- Reason: Promoted dirty low-confidence or dependency-reachable task-packet path(s) into affected scope.
- Added paths: packages/ignite-element/src/IgniteElementFactory.ts
- Evidence source: task-packet dirty scope promotion
- Evidence: task-packet dirty scope promotion | .fas/state/task-packet.json | Promoted dirty path(s): packages/ignite-element/src/IgniteElementFactory.ts
- Accuracy signal: Path was dirty in git status and present in task-packet low-confidence/dependency-reachable scope.

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
