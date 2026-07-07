# BREAKING (v3 cutover): canonical flat tagged event { type, ...fields } across emit/observe/expectEvent per docs/event-sh

## Source
Created with `fas create-task` on 2026-06-18.

## Problem
Implement docs/event-shape.md. emit unifies on the single-object member form { type, ...fields } (drop positional emit(type,payload)); observe pipeline (on / execute().events / record) delivers the flat member and DROPS the { type, payload } envelope + doubled type; getSchema event descriptors become the flat member shape; expectEvent takes the member object; EmitFromEvents typing infers fields from the Events map. BREAKING — the observe shape is the agent contract. MUST land in the SAME pre-stable beta as the view-context and expectState-rename tasks, with ONE coordinated goodway migration note. Refine the adapter subscribeEvents bridge + exact scope at planning. Decision locked 2026-06-18. Design: docs/event-shape.md.

## Acceptance criteria
- The change is verified and does not introduce regressions.
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
- .changeset/event-shape.md
- docs/api/README.md
- docs/effects-change-detection.md
- docs/event-shape.md
- docs/ignite-react.md
- docs/testing.md
- docs/v3-api-consistency.md
- examples/adapters/xstate/README.md
- examples/adapters/xstate/xstateAgentRuntimeShowcase.tsx
- examples/adapters/xstate/xstateApiShowcaseRuntime.ts
- examples/agents/smart-home/src/agentLoop.test.ts
- examples/agents/smart-home/src/home.ts
- examples/apps/dashboard-with-shared-state/src/dashboard.headless.test.ts
- examples/apps/nested-child-router/src/router.headless.test.ts
- examples/apps/spa-router/src/router.headless.test.ts
- examples/frameworks/react/src/counter.ignite.tsx
- examples/frameworks/svelte/src/stepper.ignite.ts
- examples/frameworks/vue/src/toggle.ignite.ts
- packages/ignite-core/src/RenderArgs.ts
- packages/ignite-core/src/index.ts
- packages/ignite-element/README.md
- packages/ignite-element/src/RenderArgs.ts
- packages/ignite-element/src/actor-web.ts
- packages/ignite-element/src/createComponentFactory.ts
- packages/ignite-element/src/createProjectionFactory.ts
- packages/ignite-element/src/igniteCore/types.ts
- packages/ignite-element/src/index.ts
- packages/ignite-element/src/mobx.ts
- packages/ignite-element/src/react/igniteReact.tsx
- packages/ignite-element/src/redux.ts
- packages/ignite-element/src/runtime/agent.ts
- packages/ignite-element/src/testing.ts
- packages/ignite-element/src/tests/IgniteCore.test.ts
- packages/ignite-element/src/tests/agent-runtime-headless-node.test.ts
- packages/ignite-element/src/tests/runtime-deprecations.test.ts
- packages/ignite-element/src/tests/runtime-events-bridge.test.ts
- packages/ignite-element/src/tests/testing.test.ts
- packages/ignite-element/src/tests/tools.test.ts
- packages/ignite-element/src/tests/types/actor-web-emitted-events.types.test.ts
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- packages/ignite-element/src/tests/types/testing.types.test.ts
- packages/ignite-element/src/tests/types/tools.types.test.ts
- packages/ignite-element/src/tests/types/xstate-emitted-events.types.test.ts
- packages/ignite-element/src/tools/anthropic/index.ts
- packages/ignite-element/src/tools/igniteTools.ts
- packages/ignite-element/src/tools/openai/index.ts
- packages/ignite-element/src/tools/types.ts
- packages/ignite-element/src/types/agent.ts
- packages/ignite-element/src/types/schema.ts
- packages/ignite-element/src/xstate.ts

## Scope Amendments
- 2026-07-07: implementation confirmed the affected-file list above already
  covers the event-shape cutover across public entrypoints, tool dialect types,
  runtime tests, top-level example runtime tests, and docs examples. No separate
  scope-promotion paths are recorded here. `runtime/effects.ts` and
  `runtime/schema.ts` were inspected from the initial brief scope but did not
  require edits for this cutover.

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
