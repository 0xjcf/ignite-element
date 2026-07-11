# Add opt-in projection commit scheduling for high-frequency sources

## Source

Created with `fas create-task` on 2026-07-10.

## Problem

Add the architecture-approved opt-in scheduling policy for reactive projection commits from high-frequency sources. Preserve the current synchronous default. Coalesce only presentation commits using latest-snapshot semantics; never drop or merge source snapshots, commands, source-emitted events, telemetry facts, or authoritative actor transitions. Reconcile scheduled rendering with Ignite effects so effects that depend on committed DOM still run after the matching commit, and cancel queued work safely on replacement or true disconnect.

## Acceptance criteria

- Existing components retain synchronous rendering by default with no source or type behavior change.
- Approved microtask and/or animation-frame policies coalesce redundant presentation commits to the latest snapshot while preserving command and event delivery.
- Effects, retained-node callbacks, lifecycle records, and rendered-state inspection have a documented ordering contract under every scheduler mode.
- Disconnect, reconnect, source replacement, errors, and reentrant notifications cancel or supersede queued commits without stale DOM writes or leaked callbacks.
- Deterministic fake-clock/fake-animation-frame tests and measured stress tests verify commit counts, latest-state correctness, and no regression in the synchronous path.
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

- packages/ignite-element/src/IgniteElement.ts
- packages/ignite-element/src/IgniteElementFactory.ts
- packages/ignite-element/src/igniteCore/types.ts
- packages/ignite-element/src/runtime/effects.ts
- packages/ignite-renderer/src/renderers/RenderStrategy.ts
- packages/ignite-element/src/tests/IgniteCore.test.ts
- packages/ignite-element/src/tests/IgniteElement.test.tsx

## Scope Amendments

- None.

## Implementation plan

- Write failing fake-clock and fake-animation-frame tests for sync default, coalescing, latest snapshot, effect ordering, reentrancy, cancellation, disconnect, and reconnect.
- Implement the approved scheduler at the presentation-commit boundary while leaving adapter notification, commands, events, and source truth untouched.
- Make scheduled effects and retained-node callbacks observe the matching committed DOM and contain stale or superseded work.
- Add metrics-oriented stress tests, docs, changesets, and full verification.

## Verification plan

- Run focused IgniteCore, IgniteElement, effects-ordering, and renderer strategy tests under every scheduler mode.
- Measure commit counts and latest-state correctness under burst notifications using deterministic clocks.
- Run fas validate-task, full FAS verification, bundle-size checks if exports change, and committed review.

## Risks

- Scheduling can violate the current render-before-effects contract.
- Coalescing the wrong layer can lose observable source facts or events.
- Queued commits can write stale DOM after replacement or disconnect.

## Dependencies

- Depends on keyed reconciliation task-1783719665018.
- Blocks retained-canvas stress example task-1783719697500.

## Open questions

- The architecture task decides which scheduler modes are public; implementation must preserve synchronous default behavior.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
