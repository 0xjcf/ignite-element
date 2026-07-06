# fix: address CodeRabbit navigation and teardown findings

## Source
Created with `fas create-task` on 2026-07-05.

## Problem
CodeRabbit committed review returned two valid minor findings: preserve browser default behavior for nested-router parent links on middle-click or modifier-click, and catch/log deferred disconnect teardown errors inside IgniteElement scheduleDisconnectTeardown so cleanup failures do not escape the queued microtask.

## Acceptance criteria
- Parent nav links only intercept normal unmodified left-clicks and preserve href browser behavior for middle-click and modifier-click.
- Deferred disconnect teardown catches and logs cleanup errors inside the microtask while preserving reconnect/token guards.
- Focused regressions cover both fixes.
- Focused verification and fas validate-task pass before batch snapshot.
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
- examples/apps/nested-child-router/src/router.tsx
- examples/apps/nested-child-router/src/routerMachine.test.ts
- packages/ignite-element/src/IgniteElement.ts
- packages/ignite-element/src/tests/IgniteElementFactory.test.ts

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
