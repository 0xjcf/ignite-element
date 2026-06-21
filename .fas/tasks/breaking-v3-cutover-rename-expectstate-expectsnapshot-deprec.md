# BREAKING (v3 cutover): rename expectState -> expectSnapshot (deprecated alias) + expectEvent member form per docs/v3-api

## Source
Created with `fas create-task` on 2026-06-18.

## Problem
Add expectSnapshot as the canonical assertion (mirrors getSnapshot/getView) and deprecate expectState as a delegating alias with a once-per-process dev console.warn (same pattern as getState->getSnapshot). expectEvent adopts the flat member object (coordinated with the event-shape task). Update tests, type tests, and docs. BREAKING surface change; MUST land in the SAME beta as event-shape + view-context, one goodway migration note. Decision locked 2026-06-18: rename yes (revisits the prior keep-state-in-assertions non-goal). Design: docs/v3-api-consistency.md + docs/event-shape.md.

SCOPE EXPANDED 2026-06-20 to the FULL rename (option b), not method-only. The value getSnapshot() returns is a snapshot (xstate ExtendedState = StateFrom & context; redux state tree; mobx store; actor-web extended state), NOT a state-machine "state" (the FSM state is only snapshot.value) — so rename "state" everywhere the value is named:
- assert: expectState -> expectSnapshot; type IgniteStateExpectation -> IgniteSnapshotExpectation.
- result: execute().state -> .snapshot (IgniteAgentExecutionResult).
- schema: getSchema().state -> .snapshot (IgniteAgentSchema).
- record()/story replay (agent-facing): IgniteStoryStateTraceEntry kind:"state" -> "snapshot" and .state -> .snapshot; IgniteStorySummary.finalState + serialized IgniteStorySummarySnapshot.finalState -> finalSnapshot. NOTE: this changes serialized trace output — trace snapshot tests migrate with it.
Soft landing through beta, dropped at the stable cut: delegating expectState alias + once-per-process warn; a `state` getter beside `snapshot` on the execute result; schema JSON emits BOTH `state` and `snapshot` keys during beta. Owner-approved 2026-06-20 ("great improvement to the API, high-quality DX").

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
- packages/ignite-element/src/types/agent.ts
- packages/ignite-element/src/types/schema.ts
- packages/ignite-element/src/runtime/agent.ts
- packages/ignite-element/src/index.ts
- packages/ignite-element/src/tests/testing.test.ts
- packages/ignite-element/src/tests/types/testing.types.test.ts
- docs/site (examples using expectState / result.state / schema.state — guardrail-typechecked, migrate in lockstep)
- .changeset/expect-snapshot-rename.md
- (refine the exact file set during planning; this is the full-rename (b) estimate)

## Scope Amendments
- 2026-06-20: expanded from method-only (a) to the full `state`->`snapshot` rename (b) — see Problem. Owner-approved. Pairs with the typed-view follow-up (task-1781971975611), which also touches types/agent.ts + the view projection — sequence typed-view first (additive) or fold its threading into the view-context change so the agent-runtime types aren't double-touched.

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
