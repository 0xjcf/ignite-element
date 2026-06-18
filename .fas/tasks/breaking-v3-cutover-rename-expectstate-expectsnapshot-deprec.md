# BREAKING (v3 cutover): rename expectState -> expectSnapshot (deprecated alias) + expectEvent member form per docs/v3-api

## Source
Created with `fas create-task` on 2026-06-18.

## Problem
Add expectSnapshot as the canonical assertion (mirrors getSnapshot/getView) and deprecate expectState as a delegating alias with a once-per-process dev console.warn (same pattern as getState->getSnapshot). expectEvent adopts the flat member object (coordinated with the event-shape task). Update tests, type tests, and docs. BREAKING surface change; MUST land in the SAME beta as event-shape + view-context, one goodway migration note. Decision locked 2026-06-18: rename yes (revisits the prior keep-state-in-assertions non-goal). Design: docs/v3-api-consistency.md + docs/event-shape.md.

## Acceptance criteria
- External behavior is unchanged.
- The refactored code meets the stated goal.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-element/src/testing.ts
- packages/ignite-element/src/index.ts
- .changeset/expect-snapshot-rename.md

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
