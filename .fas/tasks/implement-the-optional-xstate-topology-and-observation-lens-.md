# Implement the optional XState topology and observation lens for Ignite Alchemy

## Source
Created with `fas create-task` on 2026-07-20.

## Problem
Implement the production optional XState lens for Ignite Alchemy using the approved actor-creation observation seam without changing Story execution. Derive topology with XState-owned utilities and emit monotonic ordered observation facts for active parallel nodes, snapshot deltas, directly evidenced transitions, candidate edges, child or passive activity, context changes, and explicitly unknown causality. Keep the lens independent of Story page intervals so downstream application and coverage projections perform correlation. Bound and redact raw context evidence, fail closed on trigger and guard certainty, and preserve no-lens operation.


## Acceptance criteria
- The lens derives node and edge topology from the real XState machine without adding topology to Ignite getSchema or implementing a second graph algorithm.
- Active-state projection includes leaf and ancestor nodes across all active parallel regions.
- Every observation has a monotonic sequence, generation identity, before and after snapshot evidence, active node set, and semantic context delta.
- The lens returns a uniquely evidenced edge only when XState evidence proves it; otherwise it returns candidate topology edges or a snapshot delta with unknown or internal-passive cause.
- Child completion and passive transitions spanning a Story checkpoint are observable without reclassifying private events as Ignite commands.
- Context changes provide a deterministic semantic diff by default and a bounded, redacted, cycle-safe expandable raw representation with an explicit unavailable fallback, separate from Ignite semantic views.
- Guard and branch labels appear only from directly available XState evidence; the lens never invents a rejected-guard explanation.
- Attaching and disposing the lens cannot change actor behavior, Story receipts, subscription ordering, fixture ownership, or cleanup semantics.
- The base Story session remains fully usable when no XState lens is installed.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Install XState actor-system inspection through the W2 fixture hook before actor start, and separately derive static topology using XState-owned graph/config utilities.
- Normalize runtime evidence into monotonic, generation-scoped observation facts containing snapshot deltas, active nodes, direct evidence, candidate edges, and explicit certainty.
- Keep Story page correlation out of the lens; W5/W6 join controller page intervals to ordered observations without changing either source.

## Alternatives considered
- Rejected retrofitting observation after actor start because startup and child activity could be missed.
- Rejected inferring one exact edge from state snapshots when multiple topology edges are consistent with the evidence.
- Rejected parsing XState internals into Ignite commands, explaining rejected guards without proof, or implementing graph traversal locally.

## Affected files
- examples/agents/voice-workbench/src/story-workbench/xstate-lens.ts
- examples/agents/voice-workbench/src/story-workbench/xstate-lens.test.ts
- examples/agents/voice-workbench/src/story-workbench/types.ts

## Scope Amendments
- None.

## Implementation plan
- Characterize the exact XState 5 observation and topology evidence available from the real Voice Workbench machines and actors.
- Implement topology projection, active-state projection including parallel regions, and attach or dispose lifecycle without affecting execution.
- Emit ordered direct, candidate, child, passive, and unknown-cause observation facts without importing the Story controller or page protocol.
- Implement semantic and bounded redacted raw context diffs and fail-closed trigger, guard, or branch labeling.
- Add focused tests for parallel, passive, child-driven, unknown-cause, and cleanup paths.

## Verification plan
- Compare topology with existing xstate/graph characterization and verify no second traversal algorithm exists.
- Prove lens attachment leaves Story receipts, actor behavior, subscription order, and cleanup unchanged.
- Verify unknown causality and unavailable guard evidence are labeled rather than inferred.
- Run focused graph and lens tests, Voice Workbench typecheck, fas validate-task, and the final full lane.

## Risks
- XState may not expose rejected guard or internal cause evidence at the required granularity.
- Observation ordering may differ from Story page boundaries during child and passive transitions.
- Raw XState context can contain cycles, functions, actor references, or sensitive adapter data and must never be naively serialized.
- Lens subscriptions could alter lifecycle or retain actors if disposal is not exact.

## Dependencies
- Depends directly on shared Story and fixture task-1784602854408.
- Depends directly on approved implementation handoff task-1784655432373.
- Blocks application task-1784602901002 together with the controlled Story session controller.

## Open questions
- The POC and handoff decide which XState inspection fields are sufficiently stable to retain; unsupported fields must degrade to unknown evidence rather than widen scope.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
