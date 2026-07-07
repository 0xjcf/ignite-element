# BREAKING (v3 cutover): hard-cut expectState -> expectSnapshot + expectEvent member form per docs/v3-api

## Source
Created with `fas create-task` on 2026-06-18.

## Problem
Rename the test assertion from expectState to expectSnapshot and remove expectState from the v3 beta public surface. expectEvent adopts the flat member object (coordinated with the event-shape task). Update tests, type tests, and docs. BREAKING surface change; MUST land in the SAME beta as event-shape + view-context, one goodway migration note. Decision locked 2026-06-18: rename yes (revisits the prior keep-state-in-assertions non-goal). Design: docs/v3-api-consistency.md + docs/event-shape.md.

SCOPE EXPANDED 2026-06-20 to the FULL rename (option b), not method-only. The value getSnapshot() returns is a snapshot (xstate ExtendedState = StateFrom & context; redux state tree; mobx store; actor-web extended state), NOT a state-machine "state" (the FSM state is only snapshot.value) — so rename "state" everywhere the value is named:
- assert: expectState -> expectSnapshot; type IgniteStateExpectation -> IgniteSnapshotExpectation.
- result: execute().state -> .snapshot (IgniteAgentExecutionResult).
- schema: getSchema().state -> .snapshot (IgniteAgentSchema).
- record()/story replay (agent-facing): IgniteStoryStateTraceEntry kind:"state" -> "snapshot" and .state -> .snapshot; IgniteStorySummary.finalState + serialized IgniteStorySummarySnapshot.finalState -> finalSnapshot. NOTE: this changes serialized trace output — trace snapshot tests migrate with it.

2026-07-07 batch amendment: hard cut during v3 beta. Do not add delegating expectState aliases, result.state getters, schema.state mirrors, or story finalState/trace state compatibility. The v3 beta surface should expose only the canonical snapshot vocabulary.

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
- packages/ignite-element/src/tools/igniteTools.ts
- packages/ignite-element/src/index.ts
- packages/ignite-element/src/actor-web.ts
- packages/ignite-element/src/mobx.ts
- packages/ignite-element/src/redux.ts
- packages/ignite-element/src/xstate.ts
- packages/ignite-element/src/tests/testing.test.ts
- packages/ignite-element/src/tests/types/testing.types.test.ts
- packages/ignite-element/src/tests/IgniteCore.test.ts
- packages/ignite-element/src/tests/agent-runtime-headless-node.test.ts
- packages/ignite-element/src/tests/tools.test.ts
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- docs/site (examples using expectState / result.state / schema.state — guardrail-typechecked, migrate in lockstep)
- docs/api/README.md
- docs/testing.md
- docs/v3-api-consistency.md
- docs/v3-stable-roadmap.md
- docs/can-execute.md
- examples/adapters/xstate/README.md
- .changeset/expect-snapshot-rename.md
- .changeset/expectview-test-dsl.md
- (refine the exact file set during planning; this is the full-rename (b) estimate)

## Scope Amendments
- 2026-06-20: expanded from method-only (a) to the full `state`->`snapshot` rename (b) — see Problem. Owner-approved. Historical sequencing note: this originally paired with the typed-view follow-up (task-1781971975611), which is now complete.
- 2026-07-07: amended from beta soft-landing compatibility to v3 beta removal. This matches the current breaking cutover batch policy already applied to event shape and view context.
- 2026-07-07: CodeRabbit closeout review found one stale XState adapter README event-shape snippet. Include that self-contained example doc in this task so the flat event/snapshot cutover examples stay copy-pasteable.

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
