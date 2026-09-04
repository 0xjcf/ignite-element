# add story recorder API with behavior traces and lifecycle events

## Source
Created with `fas create-task` on 2026-04-21.

## Problem
Implement a v3 story recorder API on igniteCore runtimes so agents and tests can record behavior-first workflows and inspect DOM/component lifecycle evidence from the same story object. The API target is component.record(name), story.execute(command, payload), story.until(predicate, action), story.trace(), story.lifecycle(), story.summary(), and story.stop(). trace() should cover behavior entries such as command, state, view, and event transitions. lifecycle() should always be available on the story and return DOM/component instance lifecycle entries when components are registered, connected, rendered, disconnected, or cleaned up during the story. Keep lifecycle optional to use, not opt-in to collect, and keep the DOM layer separate from behavior assertions.

## Acceptance criteria
- `component.record(name)` creates an isolated story recorder for the runtime.
- `story.execute(commandName, payload?)` delegates to the existing runtime `execute(...)` API and records command, event, state, and view entries for that step.
- `story.until(viewPredicate, action)` repeats the action until the projected view satisfies the predicate or a bounded guard stops execution with a clear error.
- `story.trace()` returns behavior workflow entries only: command, state, view, and event transitions.
- `story.lifecycle()` is always available on the story and returns DOM/component lifecycle entries observed during the story.
- `story.summary()` exposes final state, final view, emitted events, command count, trace count, and lifecycle count.
- `story.stop()` detaches story observers without breaking the component runtime or registered custom elements.
- Existing `execute`, `getState`, `getView`, `getSchema`, `on`, `watch`, and `watchView` behavior remains backward compatible.
- XState API showcase and Playwright proof demonstrate behavior trace plus lifecycle evidence from the same story object.
- Focused tests, typecheck, Playwright proof, fas validate-task, and full verification pass
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Add a story recorder API to the `IgniteAgentRuntime` surface returned by `igniteCore(...)`.
- Keep the primary user-facing API as one story object with separate evidence methods: `story.trace()` for behavior and `story.lifecycle()` for DOM/component lifecycle.
- Implement lifecycle collection as always available on the story. If no DOM component is registered or mounted during the story, `story.lifecycle()` should return an empty list rather than requiring opt-in configuration.
- Record lifecycle evidence through the existing component factory/element lifecycle path instead of coupling DOM events into the behavior trace.
- Preserve the current headless runtime methods as the primitives that story execution uses internally.

## Alternatives considered
- A separate `getLifecycle()` runtime API. Rejected as the primary API because lifecycle evidence is most useful when scoped to a workflow under test.
- A single combined `story.trace({ include: [...] })` API. Rejected for v3 DX because behavior traces should stay clean by default and lifecycle should be available through an obvious method.
- A `record(name, { includeLifecycle: true })` option. Rejected because lifecycle should always be collectable when a story is active; developers and agents should only choose whether to read it.
- DOM-only workflow testing. Rejected because the core v3 value is behavior-first testing before a DOM layer exists.

## Affected areas
- `packages/ignite-element/src/types/agent.ts` for story runtime types.
- `packages/ignite-element/src/runtime/agent.ts` for story recorder behavior traces.
- `packages/ignite-element/src/IgniteElementFactory.ts` and `packages/ignite-element/src/IgniteElement.ts` for lifecycle event collection.
- `packages/ignite-element/src/createComponentFactory.ts` only if runtime options need to carry lifecycle recording hooks through projection binding.
- `packages/ignite-element/src/testing.ts` or related test helpers if story assertions need a small ergonomic bridge.
- `packages/ignite-element/src/examples/xstate/*` and `packages/ignite-element/tests/xstate-agent-runtime.spec.ts` for demonstration and proof.
- Astro docs under `docs/site/src/content/docs/guides/agent-runtime-v3.mdx` once the implementation shape is confirmed.

## Implementation plan
- Inspect current runtime resource ownership, watcher subscriptions, event capture, render lifecycle, and cleanup behavior.
- Define story trace and lifecycle entry types with stable, serializable shapes.
- Implement `record(name)` in the headless runtime as a scoped recorder that wraps existing `execute(...)` calls and captures before/after state and view snapshots plus returned events.
- Implement `until(predicate, action, options?)` with a conservative max-iteration guard and a useful failure message.
- Add lifecycle recording hooks to registration, connection, render, disconnection, and cleanup paths, scoped so active stories can collect entries without changing normal component behavior.
- Add `trace()`, `lifecycle()`, `summary()`, and `stop()` methods with defensive copies of collected evidence.
- Update the XState API showcase and agent runtime showcase to demonstrate behavior and lifecycle evidence from a story.
- Add focused unit/type tests and strengthen the Playwright proof to drive a story without DOM selectors.

## Verification plan
- Run focused Vitest tests for the story recorder behavior and lifecycle evidence.
- Run type tests for `record`, `story.execute`, `story.until`, `story.trace`, `story.lifecycle`, and `story.summary`.
- Run the XState example TypeScript/build checks.
- Run the XState Playwright proof for story trace and lifecycle evidence.
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Story recording must not change existing command execution semantics or event ordering.
- Lifecycle hooks must not leak memory across stories, shared adapters, or disconnected custom elements.
- Trace entries should remain serializable enough for agents, snapshots, and test reporters.
- `until(...)` must guard against infinite loops without hiding legitimate long workflows.
- Lifecycle collection should stay scoped to story sessions so normal runtime use has minimal overhead.

## Dependencies
- Depends on the current v3 headless runtime surface and command metadata work in the active worktree.
- No external service or package dependency is required.

## Open questions
- Non-blocking assumption: `story.trace()` returns behavior entries only and `story.lifecycle()` returns lifecycle entries separately.
- Non-blocking assumption: lifecycle evidence is collected while a story is active and returns an empty array when no DOM lifecycle occurred.
- Decide during implementation whether `until(...)` needs a public options object for `maxSteps`, or whether a fixed default guard is enough for v3.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
