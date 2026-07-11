# Add named igniteTest rehearsals with trace snapshots

## Source
Created with `fas create-task` on 2026-07-11.

## Problem
Add a compact named-rehearsal layer to the existing igniteTest scenario API. Consumers define a rehearsal such as serve-ball with an asserted initial snapshot, one typed object-form command call, and expected final snapshot/view/events, then call await scenario.rehearse("serve-ball") and receive the existing serializable IgniteStorySnapshot trace. Reuse component.record(), story execution, trace serialization, and summary machinery rather than introducing a second recorder or state authority. The initial state is asserted, never injected; consumers provide a fresh isolated runtime when they need repeatable rehearsals, and Ignite must not silently reset shared sources.

## Acceptance criteria
- igniteTest accepts typed named rehearsal definitions without changing the existing igniteTest(component, { host }) behavior for consumers that do not use rehearsals.
- scenario.rehearse("name") infers the declared rehearsal names and rejects unknown names at type level and runtime.
- Each rehearsal supports an asserted from snapshot, a canonical object-form when command call, and expected to.snapshot, to.view, and to.events assertions using existing deep-partial or predicate semantics.
- Command input typing remains discriminated: required inputs are required, optional inputs remain optional, and no-input commands omit input.
- A successful rehearsal returns the existing serializable IgniteStorySnapshot shape with trace, lifecycle, and final summary; no parallel trace schema or public inspection API is added.
- A mismatch reports the rehearsal name, failing phase, expected and received values, and the serialized trace accumulated before cleanup.
- Rehearsal recording is stopped in a finally path on success or failure and does not leak lifecycle listeners or alter source ownership.
- from is assertion-only: rehearsals never inject, rehydrate, rewind, or silently reset state; repeatable execution requires a consumer-supplied fresh isolated runtime/scenario.
- Commands remain intent inputs and emitted events remain typed facts; serve-ball may name the rehearsal while serveBall is the command and ball-served is the emitted event.
- Focused runtime, type-level, error-diagnostic, cleanup, and documentation tests pass, with no DOM required for headless rehearsals.
- The task is tracked in .fas/TASKS.md and queued independently from the retained-surface epic.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution

- Compose the existing scenario assertions and story recorder behind a named rehearsal definition:

  ```ts
  const scenario = igniteTest(component, {
    rehearsals: {
      "serve-ball": {
        from: { phase: "ready" },
        when: { command: "serveBall" },
        to: {
          snapshot: { phase: "playing" },
          view: { ballInPlay: true },
          events: [{ type: "ball-served" }],
        },
      },
    },
  });

  const result = await scenario.rehearse("serve-ball");
  ```

- Implement `rehearse()` as orchestration over `given`, `component.record(name)`, object-form story execution, existing expectations, `snapshotStory`, and `story.stop()` in `finally`.
- Return `IgniteStorySnapshot` directly so consumers receive the existing trace, lifecycle, and summary format.

## Alternatives considered

- A new rehearsal trace type: rejected because `IgniteStorySnapshot` already supplies a serializable trace and final summary.
- State injection or automatic reset: rejected because it would create hidden state authority and unsafe behavior for shared sources.
- Treating `serve-ball` as a raw source event: rejected because rehearsal names describe scenarios, commands remain intent inputs, and events remain emitted facts.
- Multi-command choreography in the first slice: deferred to keep the public addition small and prove the one-command end-state contract first.

## Affected files
- packages/ignite-element/src/testing.ts
- packages/ignite-element/src/types/agent.ts
- packages/ignite-element/src/tests/testing.test.ts
- packages/ignite-element/src/tests/types/testing.types.test.ts
- docs/site/src/content/docs/api/testing-dsl.mdx

## Scope Amendments
- None.

## Implementation plan
- Write failing runtime and type tests for named lookup, typed command inputs, from/to assertions, returned IgniteStorySnapshot, diagnostics, and cleanup.
- Add generic rehearsal definition and result types by composing existing IgniteSnapshotExpectation, IgniteViewExpectation, IgniteEventExpectation, IgniteCommandCall, and IgniteStorySnapshot contracts.
- Extend the scenario driver to assert from, record the named story, execute the canonical command, assert to values, snapshot the story, and stop recording in finally without resetting the runtime.
- Document the minimal API, fresh-isolated-runtime requirement, serve-ball example, and distinction between rehearsal names, commands, and emitted events; add a changeset if the testing export changes.

## Verification plan
- Run focused packages/ignite-element/src/tests/testing.test.ts coverage for successful, failing, cleanup, and headless rehearsals.
- Run packages/ignite-element/src/tests/types/testing.types.test.ts plus package typecheck for name and command-input inference.
- Run fas validate-task, the fast verification lane, full verification before closeout, and committed review.

## Risks
- Adding a second trace representation would drift from IgniteStorySnapshot and duplicate recorder behavior.
- Implicit state reset or injection would make shared-source behavior unsafe and hide nondeterminism.
- Overloading event vocabulary for commands would blur intent inputs and emitted facts.
- Generic inference across named definitions can widen command names or inputs unless the mapped union is preserved.

## Dependencies
- Independent of the retained-surface epic and its stable-release dependency chain.
- Builds only on already-shipped igniteTest, component.record(), object-form command calls, and IgniteStorySnapshot contracts.
- Does not block or depend on the voice/text workbench unless separately connected by a future queue decision.

## Open questions
- Whether a later task should support multi-command rehearsal sequences; this slice intentionally starts with one canonical command call per named rehearsal.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
