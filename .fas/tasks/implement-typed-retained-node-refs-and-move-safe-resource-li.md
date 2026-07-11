# Implement typed retained-node refs and move-safe resource lifecycle

## Source

Created with `fas create-task` on 2026-07-10.

## Problem

Implement the architecture-approved generic retained-node access path for Ignite JSX and reactive Ignite components. The primitive must support imperative presentation resources without turning drawing or editor state into source truth. Cover initial commit, update, replacement, ref identity change, error containment, same-tick move preservation, true-disconnect teardown, reconnect, and isolated/shared source ownership. Keep the default renderer contract source-compatible and do not add canvas-specific APIs.

## Acceptance criteria

- Ignite JSX exposes the approved typed retained-node ref or commit primitive and no longer silently ignores supported ref values.
- Initial mount and every relevant update can commit to the stable node, while replacement and true disconnect deliver deterministic cleanup exactly once.
- Same-tick DOM moves preserve retained resources and do not recreate adapters, observers, animation loops, or canvas/editor contexts.
- Callback and cleanup failures are contained and reported without masking adapter cleanup or corrupting lifecycle bookkeeping.
- Focused renderer, lifecycle, type-level, shared/isolated ownership, and move/reconnect tests pass through the repo verification lane.
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

- packages/ignite-renderer/src/renderers/jsx/types.ts
- packages/ignite-renderer/src/renderers/jsx/renderer.ts
- packages/ignite-renderer/src/renderers/jsx/IgniteJsxRenderStrategy.ts
- packages/ignite-element/src/IgniteElement.ts
- packages/ignite-element/src/IgniteElementFactory.ts
- packages/ignite-element/src/tests/renderers
- packages/ignite-element/src/tests/IgniteElement.test.tsx

## Scope Amendments

- None.

## Implementation plan

- Write failing renderer and lifecycle tests for initial commit, updates, replacement, move, disconnect, reconnect, and callback failures.
- Implement the approved typed retained-node primitive through JSX types, normalization, DOM commit, and Ignite component lifecycle.
- Integrate cleanup with shared and isolated adapter ownership and move-safe teardown without adding canvas-specific behavior.
- Add type tests, focused docs, and changesets, then run fast and full verification.

## Verification plan

- Run focused Ignite JSX renderer, IgniteElement lifecycle, shared/isolated ownership, and type tests after each commit-plan step.
- Run fas validate-task after the full task change set.
- Run the full FAS verification lane and external review before closeout.

## Risks

- Double-calling ref cleanup can leak or destroy retained resources.
- DOM moves can be mistaken for true disconnects and recreate stateful resources.
- Callback errors can mask adapter cleanup unless lifecycle bookkeeping is exception-safe.

## Dependencies

- Depends on architecture task-1783719632720.
- Blocks keyed reconciliation task-1783719665018.

## Open questions

- None after the architecture task; reassess instead of improvising if its selected API cannot satisfy the conformance matrix.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
