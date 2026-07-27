# Implement typed retained-node refs, commit directives, and move-safe lifecycle

## Source

Created with `fas create-task` on 2026-07-10.

## Problem
Implement the architecture-approved retained-node contract for Ignite JSX using typed callback refs and a reserved commit renderer directive. ref acquires a stable DOM node and owns only node-bound presentation resources; commit receives that node after reconciliation and ref acquisition and synchronizes the latest projected data. Neither directive leaks to the DOM, creates or wraps a state source, binds environmental capability ports, or stops or disposes the exact native source passed to igniteCore. Cover replacement, callback identity, failures, same-tick moves, true disconnect, reconnect, and isolated or shared source observation without adding canvas-specific APIs or framework scheduling.


## Acceptance criteria
- Ignite JSX types expose generic callback ref and commit directives for compatible retained nodes, and neither directive is forwarded to the DOM.
- ref acquisition runs after node materialization, may return cleanup, and cleanup occurs exactly once for ref replacement, node replacement, or true disconnect.
- ref cleanup owns only resources attached to retained presentation identity such as Canvas or Cytoscape instances, observers, node listeners, and consumer draw queues; it never stops or disposes the source.
- commit runs synchronously after reconciliation and ref acquisition with the current projection and cannot become source provisioning, command authority, or a generic environmental effect.
- The exact XState, Redux, MobX, Actor-Web, or custom source passed to igniteCore retains its established shared or isolated ownership independently of retained node lifetime.
- Same-tick DOM moves and keyed reorders preserve retained resources, focus, selection, canvas or editor identity, and source observation.
- Callback and cleanup failures are contained without masking adapter cleanup, source lifecycle, sibling traversal, or renderer bookkeeping.
- No commitScheduling option, animation-frame policy, canvas helper, source wrapper, or second state authority is added to igniteCore.
- Focused renderer, lifecycle, type, source-ownership, move or reconnect, and SSR or headless tests pass.
- TDD and DDD guardrails remain satisfied and the work stays tracked in the live queue.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution

- Reserve `ref` and `commit` in Ignite JSX normalization so neither reaches DOM
  attributes or properties.
- Track stable node and ref identity privately in the renderer. Acquire refs
  after materialization, store one returned cleanup per node/ref pair, and
  consume cleanup exactly once on ref replacement, incompatible node
  replacement, or true disconnect.
- Run `commit` synchronously after ordinary reconciliation and ref acquisition
  with the current projection callback. Contain errors without rolling back DOM
  or suppressing sibling callbacks.
- Preserve source-only ownership: renderer lifecycle may subscribe to and
  project the exact source through existing Ignite adapters, but ref cleanup
  never stops, closes, or disposes that source.
- Keep draw cadence, Canvas or Cytoscape construction, observers, node-local
  input listeners, and accessibility companions in consumer presentation code;
  add no scheduler or canvas-specific Ignite API.

## Alternatives considered

- Put retained work in Ignite effects: rejected because effects have transition
  cadence and no stable node identity or deterministic teardown point.
- Let `commit` create or dispose the state source: rejected because source
  provisioning and retained presentation are separate lifecycles.
- Stop shared sources on true element disconnect: rejected because other
  projections may still consume the application-owned source.
- Add Canvas, Cytoscape, editor, or scheduling-specific APIs: rejected until
  repeated dogfood proves the generic ref and commit contract insufficient.

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
- Write failing JSX type, renderer, and lifecycle tests for ref acquisition and cleanup, commit ordering, updates, callback identity, replacement, moves, disconnect, reconnect, failures, and source-lifecycle independence.
- Implement reserved ref and commit normalization plus post-reconciliation invocation without DOM leakage or access to provisioning ports.
- Integrate retained cleanup with shared and isolated adapter observation without taking ownership of the exact native source, then add focused docs, a changeset, and verification.

## Verification plan
- Run focused Ignite JSX renderer, IgniteElement lifecycle, shared and isolated source ownership, and type tests after each commit-plan step.
- Add explicit tests that ref cleanup never calls source stop or dispose and source shutdown does not depend on retained-node presence.
- Run fas validate-task and the full FAS verification lane before closeout.

## Risks
- Double-calling ref cleanup can leak or destroy retained resources.
- DOM moves can be mistaken for disconnects and recreate stateful resources.
- Callback errors can mask adapter cleanup unless bookkeeping is exception-safe.
- Source lifecycle could be accidentally coupled to element or retained-node lifecycle if ownership tests are incomplete.

## Dependencies
- Depends on retained-surface architecture task-1783719632720.
- Blocks keyed reconciliation task-1783719665018 and final source-provisioning guidance task-1784909364827.
- The source-only provisioning epic is a sibling contract; this task consumes its ownership boundary but does not depend on its implementation chain.

## Open questions
- None. Use the architecture-approved ref and commit contract; return any requirement to provision, wrap, or dispose sources through renderer callbacks to architecture.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
