# test: lock multi/zero-arg setX exclusion in igniteReact type tests (QA follow-up)

## Source
Created with `fas create-task` on 2026-06-19.

## Problem
QA (task-1781805261094) found the igniteReact type test does not lock the setX exclusion branch. Fix: add a multi-arg command (e.g. setRange: (min: number, max: number) => void) and a zero-arg setX (setNothing: () => void) to the CounterCommands fixture, then assert keyof IgniteReactProps<...> EQUALS exactly 'onCountChanged' | 'label' via toEqualTypeOf on the key union — replacing the structurally-always-true not.toEqualTypeOf<'increment'>() assertions at igniteReact.types.test.ts:82-83. Locks the Parameters<>['length'] extends 1 arity filter in IgniteReactSetterProps (igniteReact.tsx:68-74). Inference is already correct (QA verified empirically); this only strengthens the guard. Verify: vitest --typecheck on the type test.

## Acceptance criteria
- The change is verified and does not introduce regressions.
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
- packages/ignite-element/src/tests/types/igniteReact.types.test.ts

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
