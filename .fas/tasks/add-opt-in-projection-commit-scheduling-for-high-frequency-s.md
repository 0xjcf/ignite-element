# Evaluate retained-surface scheduling needs after canvas and Mesh Pong dogfood

## Source

Created with `fas create-task` on 2026-07-10.

## Problem
Evaluate whether the shipped ref/commit lifecycle and consumer-owned requestAnimationFrame or microtask scheduling are sufficient for high-frequency retained surfaces after the local canvas stress example and read-only Actor-Web Mesh Pong validation. This is an evidence and decision task, not a predetermined API implementation. Measure reconciliation and commit cadence, stale-frame behavior, effect ordering, cleanup, and consumer complexity. Prefer no new Ignite public surface. Only if evidence shows that full projection reconciliation must be coalesced should this task propose a separately planned registration-level renderer policy; commitScheduling in igniteCore remains rejected.


## Acceptance criteria
- The task evaluates the shipped synchronous ref/commit contract with consumer-owned scheduling against measured canvas stress and Mesh Pong evidence.
- The evidence records source cadence, reconciliation cadence, commit/draw cadence, latest-snapshot correctness, effect ordering, disconnect/reconnect behavior, and consumer code complexity.
- The default verdict is no framework API when retained-resource scheduling is sufficient; no speculative scheduler implementation or changeset is required.
- Any demonstrated framework gap identifies the exact layer that must be scheduled and explains why a consumer-owned retained resource cannot solve it.
- Any proposed follow-up uses the existing component registration boundary, preserves synchronous default behavior, and is created as a separate task with compatibility and deterministic-test requirements.
- commitScheduling or equivalent configuration is not added to igniteCore by this task.
- The verdict updates the architecture and final documentation inputs and preserves commands, events, effects, source snapshots, and Actor-Web authority.
- The work is tracked in .fas/TASKS.md and queued in .fas/queue/tasks.json.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

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
- Collect deterministic measurements from the retained-canvas stress example and the pinned Mesh Pong consumer validation.
- Compare synchronous reconciliation plus consumer-owned requestAnimationFrame/microtask scheduling against the observed performance and ordering requirements.
- Record a no-API verdict when sufficient, or create a separate evidence-backed implementation brief at the component registration boundary when insufficient.
- Feed the decision and measurements into the final retained-interface documentation task.

## Verification plan
- Re-run the stress and Mesh Pong validation measurements with deterministic clocks where possible.
- Validate latest-snapshot correctness, callback/effect ordering, cleanup, and no loss of commands/events/source facts.
- Run fas validate-task and review the evidence-to-verdict trace; production full verification is required only if tracked production files unexpectedly change.

## Risks
- Benchmarks can overfit one canvas example and create an unnecessary general API.
- Scheduling the wrong layer can violate render-before-effects ordering or hide source facts.
- A no-API verdict can be wrong if consumer complexity is not measured alongside frame cadence.

## Dependencies
- Depends on read-only Actor-Web Mesh Pong validation task-1783719721452, which itself depends on the local canvas stress example.
- Blocks final retained-interface documentation task-1783719740973.
- Does not implement a scheduler; any evidence-backed public API requires a new separately planned task.

## Open questions
- Does dogfood demonstrate a need to coalesce full Ignite reconciliation, or is scheduling retained drawing inside the consumer-owned resource sufficient?

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
