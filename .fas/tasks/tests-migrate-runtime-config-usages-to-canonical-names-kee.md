# Tests: migrate runtime/config usages to canonical names; kee

## Source
Created with `fas create-task` on 2026-06-06.

## Problem
Spike: .fas/state/spikes/agent-runtime-api-review.md (T3, depends on T1+T2). Migrate the ~4 test files using .getState( and ~2 using .watch( to getSnapshot()/watchSnapshot(); migrate igniteCore({ states }) test/type usages to view. ADD a focused test asserting the deprecated aliases (getState/watch/subscribe and the states config key) still work AND emit a once-per-process dev console.warn (spy on console.warn, assert called once). Do NOT migrate examples/xstate/*Machine.ts (XState's own states). Keep tests for execute().state and igniteTest given/expectState unchanged (state vocabulary is intentional).

## Automation admission
- Expected operator value: Improves operator leverage around "Tests: migrate runtime/config usages to canonical names; keep alias-coverage tests" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- canonical-name tests pass
- at least one test asserts each deprecated alias still works and warns once
- no XState machine states edited
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
- packages/ignite-element/src/tests/IgniteCore.test.ts
- packages/ignite-element/src/tests/createComponentFactory.test.ts
- packages/ignite-element/src/tests/testing.test.ts
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts

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
