# typing: surface the view projection through igniteCore's return so getView()/expectView are typed (not Record<string,unk

## Source
Created with `fas create-task` on 2026-06-20.

## Problem
Type-level follow-up surfaced by dogfooding expectView (task-1781798484574). The view projection type does NOT flow end-to-end: igniteCore(...) returns IgniteCoreReturn<...> whose type does NOT surface the StatesResult/view-projection (the view callback's return) into IgniteAgentRuntime's 4th 'View' generic, so getView() is loosely typed and the test DSL's RuntimeView<Runtime> extractor (already in place in packages/ignite-element/src/testing.ts) falls back to Record<string,unknown> — view keys are 'unknown'. This is an ASYMMETRY: expectState IS typed (RuntimeState flows from the 1st generic), expectView is not. GOAL: thread the view-projection type (StatesResult) through IgniteCoreReturn -> the agent-runtime surface (getView(): View, watchView(), record(), IgniteAgentSchema<View>) so the View generic carries the projection. The test-DSL side is already wired (IgniteTestScenario/IgniteTestDriver/createTestScenario carry a View generic + RuntimeView extractor from the expectView change); once igniteCore's return surfaces the projection into IgniteAgentRuntime's View, RuntimeView extracts it and expectView/getView type end-to-end with no further test-DSL change. Likely needs the threading in igniteCore/types.ts (IgniteCoreReturn), runtime/agent.ts (createAgentRuntime typed return), types/agent.ts (IgniteAgentRuntime/IgniteAgentSchema View), and the per-adapter igniteCore wrappers (xstate/redux/mobx/actor-web) that build the return type — refine the exact set during planning/investigation. Type-level only: NO runtime behavior change. Pre-stable type tightening (loose Record<string,unknown> -> typed projection) — note in the changeset; acceptable in beta. Verify with type-level tests (src/tests/types/*.types.test.ts) asserting getView() and the expectView predicate see the projection's keys, and tighten the expectView test predicate in src/tests/testing.test.ts to rely on typed view access once it flows. Related: docs/v3-api-consistency.md (expectView row); the expectView feat (commit 8561826).

## Acceptance criteria
- getView() on an igniteCore(...) runtime returns the typed view projection (not Record<string,unknown> / Record<never,never>)
- The test DSL's expectView is typed end-to-end (RuntimeView extracts the projection); a type-level test locks getView()/expectView typed access
- No runtime behavior change — purely type-level threading; full verify stays green
- Changeset notes the pre-stable type tightening
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
- packages/ignite-element/src/igniteCore/types.ts
- packages/ignite-element/src/runtime/agent.ts
- packages/ignite-element/src/types/agent.ts
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- packages/ignite-element/src/tests/testing.test.ts
- .changeset

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
