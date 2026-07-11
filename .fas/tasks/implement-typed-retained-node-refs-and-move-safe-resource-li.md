# Implement typed retained-node refs, commit directives, and move-safe lifecycle

## Source

Created with `fas create-task` on 2026-07-10.

## Problem
Implement the architecture-approved generic retained-node contract for Ignite JSX using typed callback refs and a reserved commit renderer directive. ref acquires the stable DOM node and may return cleanup; commit receives the node after reconciliation and ref acquisition on initial mount and relevant projection updates. Neither directive may leak as a DOM attribute or property. Cover replacement, ref or commit identity changes, callback failures, same-tick move preservation, true-disconnect teardown, reconnect, and isolated/shared source ownership without adding canvas-specific APIs or framework scheduling.


## Acceptance criteria
- Ignite JSX types expose generic callback ref and commit directives for compatible retained nodes, and neither directive is forwarded to the DOM.
- ref acquisition runs after node materialization, may return cleanup, and cleanup occurs exactly once for ref replacement, node replacement, or true disconnect.
- commit runs synchronously after reconciliation and ref acquisition on initial mount and relevant updates with the current projection; callback identity changes do not leak stale callbacks.
- Same-tick DOM moves and keyed reorders preserve retained resources, observers, animation loops, canvas/editor contexts, and source ownership.
- Callback and cleanup failures are contained and reported without masking adapter cleanup or corrupting lifecycle bookkeeping.
- No commitScheduling option, animation-frame policy, canvas helper, or second state authority is added to igniteCore.
- Focused renderer, lifecycle, type-level, shared/isolated ownership, move/reconnect, and SSR/headless tests pass through the repo verification lane.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: keep projection calculation deterministic, confine retained-resource work to the renderer/lifecycle shell, and keep commands/events/effects semantics unchanged.
- The work is tracked in .fas/TASKS.md and queued in .fas/queue/tasks.json.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

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
- Write failing JSX type, renderer, and lifecycle tests for ref acquisition/cleanup, commit ordering, updates, callback identity, replacement, move, disconnect, reconnect, errors, and headless execution.
- Implement reserved ref and commit normalization plus post-reconciliation invocation without DOM leakage.
- Integrate cleanup with shared and isolated adapter ownership and move-safe teardown without adding scheduling or canvas-specific behavior.
- Add type tests, focused docs, a changeset, and fast/full verification.

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
- None; use the architecture-approved ref and commit contract and return any incompatible requirement to architecture instead of improvising.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
