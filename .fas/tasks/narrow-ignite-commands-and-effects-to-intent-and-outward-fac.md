# Narrow Ignite commands and effects to intent and outward-fact callbacks

## Source

Created with `fas create-task` on 2026-07-24.

## Problem

Apply the architecture standard to the pre-stable public callback contract. Commands receive only the adapter-native actor and command metadata helper and express public intent. Effects receive snapshot, prevSnapshot, select, and emit; they remain synchronous transition-to-public-fact bridges and do not receive actor or host. Keep the actual DOM or headless host internal for CustomEvent dispatch and error reporting. Remove promise-returning effect semantics, migrate real examples and docs, preserve source-emitted event bridges, and provide a coordinated beta migration note and changeset.

## Purpose and migration model

This task removes two public escape hatches before stable v3:

- Commands must not read hidden intent from the host or mutate presentation. Host-derived values become explicit command inputs, commands send intent to the adapter-native source, and projected source state drives rendering.
- Effects must not feed work back into the source, mutate the host, or own promises. Asynchronous work, cancellation, failure, and cleanup move into native actors, actions, thunks, middleware, methods, or transports; effects synchronously translate accepted state transitions into typed outward facts.

Representative command migration:

```ts
// Before: hidden DOM input and imperative presentation mutation.
commands: ({ actor, host }) => ({
  increment: () => {
    const amount = Number(host.dataset.amount ?? 1);
    host.dataset.lastAmount = String(amount);
    actor.send({ type: "INCREMENT", amount });
  },
});

// After: explicit intent; state and rendering own presentation.
commands: ({ actor, command }) => ({
  increment: command(
    (amount: number) => actor.send({ type: "INCREMENT", amount }),
    { input: command.number({ minimum: 1 }) },
  ),
});
```

Representative effect migration:

```ts
// Before: the projection callback owns async work and source feedback.
effects: async ({ actor, host, snapshot }) => {
  host.dataset.status = "saving";
  const result = await saveOrder(snapshot.context.order);
  actor.send({ type: "SAVE_SUCCEEDED", result });
};

// After: the native source owns saveOrder, cancellation, and failure.
// The effect publishes only the accepted outward fact.
effects: ({ snapshot, select, emit }) => {
  const status = select((state) => state.context.saveStatus);
  if (status.changed && status.current === "saved") {
    emit({ type: "order-saved", orderId: snapshot.context.orderId });
  }
};
```

## Acceptance criteria

- CommandContext no longer exposes host and all public types, overloads, tests, examples, and docs compile against actor plus command only.
- EffectContext no longer exposes actor or host and effect callbacks return void rather than promise-like work.
- Host-derived command values are migrated to explicit typed inputs, and host-written presentation is migrated to projected state plus rendering or the separate retained ref/commit lifecycle.
- Async effect work and effect-to-source feedback are migrated to ecosystem-native actors, actions, thunks, middleware, methods, or transports with explicit success, failure, cancellation, and cleanup facts where applicable.
- Current docs describe effects as synchronous transition-to-outward-fact callbacks rather than general-purpose consequence handlers.
- Internal DOM and EventTarget hosts continue to dispatch typed events and route errors without becoming public mutation capabilities.
- XState and Actor-Web emitted facts remain preferred when sources emit natively; Redux and MobX transition-to-event effects remain supported.
- Headless Node tests prove the same callback contract without document, HTMLElement, browser globals, or retained resources.
- A breaking beta changeset and migration table cover every source, docs, test, and example update in one coordinated cutover.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution

- Change the public command context to `{ actor, command }`, where `actor` is the adapter-native intent target and `command` is metadata only. Remove `host` from all command overloads and public projections.
- Change the public effect context to `{ snapshot, prevSnapshot, select, emit }` and require a `void` return. Remove `actor`, `host`, and promise-like results while preserving change filtering and typed outward event emission.
- Keep DOM `CustomEvent` dispatch, headless `EventTarget` dispatch, and runtime error routing inside the projection/runtime implementation; these internals may hold the host but do not expose it as a consumer capability.
- Ship the type change, runtime behavior, examples, migration table, and beta changeset as one coordinated cutover so no supported surface teaches the old callback contract.

## Alternatives considered

- Keep `host` as a deprecated callback property: rejected because deprecated access would preserve the architectural escape hatch throughout the beta and continue producing new host-coupled code.
- Narrow `host` to `HTMLElement` or `EventTarget`: rejected because the problem is mutation authority, not the precision of the host type.
- Keep `actor` or async work in effects: rejected because feedback belongs in source-native actions, actors, thunks, or store methods where success, failure, cancellation, and cleanup can re-enter as explicit facts.
- Add a replacement host API in the same change: rejected unless a real migration case cannot be expressed through source provisioning, outward events, or retained presentation callbacks.

## Boundaries and non-goals

- Do not remove the host from Ignite internals; DOM CustomEvent dispatch, headless EventTarget dispatch, rendering, retained presentation, and runtime error routing still require internal host ownership.
- Do not ban asynchronous work in native sources or command-triggered source behavior. Only promise-returning Ignite effects and effect-owned async coordination are removed.
- Do not replace source-native emitted facts. XState and Actor-Web should continue to emit through their native runtime seams where available.
- Do not fold routing, cross-adapter provisioning, retained ref/commit implementation, or Ignite Alchemy work into this task.
- Do not introduce a generic port registry, lifecycle container, or replacement host capability on igniteCore.

## Architecture Context

This task inherits the normalized architecture context accepted by
`task-1784909239951` without reconstructing or weakening its ownership model.

```json
{
  "schemaVersion": 1,
  "responsibilityAxis": {
    "intent": [
      "Standardize environmental integration around source-owned behavior, explicit capability ports, application-provided adapters, exact native sources, and native lifecycle ownership without turning Ignite into a dependency-injection or disposal runtime."
    ],
    "behavior": [
      "A source library owns state transitions, dependency binding, and the lifecycle of environmental resources attached to that source.",
      "The consuming application selects concrete adapters and constructs the exact XState, Redux, MobX, Actor-Web, or custom source passed to Ignite.",
      "Ignite projects source state, sends command intent, publishes outward facts through effects, and delegates node-bound retained resources to presentation ref and commit callbacks."
    ],
    "policies": [
      "Commands express intent and never mutate a host or environment directly.",
      "Ignite effects publish outward post-render facts and do not own environmental I/O, source cleanup, or retained resources.",
      "Capability ports describe environmental needs; concrete adapters are bound through the selected source library native composition APIs.",
      "igniteCore receives the exact supported source and no wrapper, port bag, driver, environment, provide hook, or disposal policy.",
      "Native source cleanup and retained presentation cleanup remain distinct ownership boundaries."
    ],
    "capabilities": [
      {
        "name": "environment-independent application behavior",
        "qualifier": "business",
        "owner": "application domain source"
      },
      {
        "name": "source-native provisioning and lifecycle",
        "qualifier": "runtime",
        "owner": "selected source library and consuming application"
      },
      {
        "name": "architecture-boundary reasoning and conformance",
        "qualifier": "agent-model",
        "owner": "Ignite architecture standard and FAS roles"
      },
      {
        "name": "DOM projection and retained interface lifecycle",
        "qualifier": "host-product",
        "owner": "Ignite renderer plus consuming presentation code"
      }
    ],
    "ports": [
      "application capability interfaces consumed by source behavior",
      "source command and snapshot contracts consumed by Ignite Core",
      "outward effect-fact callbacks consumed by application observers",
      "presentation ref and commit callbacks for retained renderer resources"
    ],
    "adapters": [
      "browser navigation, storage, network, and clock implementations",
      "Node filesystem, process, transport, and clock implementations",
      "deterministic fake implementations for tests",
      "XState provide, Redux construction or middleware injection, MobX constructor or factory injection, and Actor-Web source composition",
      "DOM, Canvas, Cytoscape, editor, and similar presentation adapters"
    ],
    "infrastructure": [
      "browser and Node host APIs",
      "XState, Redux, MobX, Actor-Web, and custom source runtimes",
      "DOM and retained presentation instances"
    ],
    "projections": [
      "Ignite DOM or headless output derived from exact source state",
      "outward transition facts published by effects",
      "retained Canvas and Cytoscape updates committed from current projection data"
    ]
  },
  "executionAxis": {
    "functionalCore": [
      "deterministic state transitions and policy decisions",
      "commands as source-directed intent",
      "capability contracts with no concrete host imports",
      "projection data derived from source snapshots"
    ],
    "imperativeShell": [
      "select concrete browser, Node, test, or transport adapters",
      "bind implementations through source-library-native composition",
      "start and stop shared sources through native lifecycle APIs",
      "acquire and release node-bound retained resources through ref cleanup",
      "synchronize retained presentation from current projection data through commit"
    ]
  },
  "ownership": [
    {
      "owner": "application domain source",
      "responsibilities": [
        "own behavior, policy, commands, and accepted transitions",
        "depend on capability contracts rather than concrete host APIs"
      ],
      "maturity": "current"
    },
    {
      "owner": "source-library composition",
      "responsibilities": [
        "bind concrete implementations through native APIs",
        "return the exact source consumed by Ignite",
        "define native source start, stop, shutdown, cancellation, and subscription cleanup"
      ],
      "maturity": "current"
    },
    {
      "owner": "Ignite Core",
      "responsibilities": [
        "consume exact source snapshots and native command targets",
        "remain independent of ports, environment adapters, and application lifecycle wrappers"
      ],
      "maturity": "current"
    },
    {
      "owner": "Ignite Element presentation",
      "responsibilities": [
        "project source state into DOM and headless targets",
        "publish outward facts through effects",
        "provide retained ref and commit seams without taking source ownership"
      ],
      "maturity": "target"
    }
  ],
  "maturity": [
    {
      "claim": "Ignite Core consumes source contracts and remains independent of concrete host APIs.",
      "status": "current",
      "evidenceRefs": [
        "docs/architecture.md",
        "docs/shared-architecture-model.md"
      ]
    },
    {
      "claim": "Exact source-only provisioning is the accepted canonical pattern.",
      "status": "target",
      "evidenceRefs": [
        ".fas/tasks/define-the-canonical-source-native-provisioning-and-host-bou.md"
      ]
    },
    {
      "claim": "Effects publish outward facts, commands express source intent, and retained ref and commit own only node-bound presentation resources.",
      "status": "transitional",
      "evidenceRefs": [
        ".fas/tasks/narrow-ignite-commands-and-effects-to-intent-and-outward-fac.md",
        ".fas/tasks/implement-typed-retained-node-refs-and-move-safe-resource-li.md"
      ]
    }
  ],
  "boundaries": [
    "Functional cores may name capabilities but may not import concrete browser, DOM, Node, Canvas, Cytoscape, provider, or transport implementations.",
    "Applications bind concrete ports through native source-library composition and pass only the exact result to igniteCore.",
    "Ignite Core receives no source wrapper, concrete ports, drivers, environments, provide hooks, or disposal policy.",
    "Native source lifecycle owns behavior-related listeners, timers, transports, cancellation, and shutdown.",
    "Presentation ref and commit own node-bound retained resource identity and updates but never source lifecycle."
  ],
  "forbiddenCouplings": [
    "Domain machines, reducers, or models import concrete host or provider APIs.",
    "igniteCore accepts ports, drivers, environments, provisioning hooks, source wrappers, or application disposal policy.",
    "Commands mutate the host before source acceptance.",
    "Ignite effects own environmental I/O, source feedback, listener lifetime, or retained renderer identity.",
    "ref or commit creates, wraps, starts, stops, or disposes the source.",
    "Headless source composition depends on DOM globals or custom-element lifecycle."
  ],
  "evidenceRefs": [
    ".fas/tasks/define-the-canonical-source-native-provisioning-and-host-bou.md",
    ".fas/tasks/refactor-routing-examples-to-source-native-navigation-ports-.md",
    ".fas/tasks/dogfood-source-native-provisioning-across-redux-mobx-node-an.md",
    ".fas/tasks/enforce-source-provisioning-boundaries-and-decide-the-minima.md",
    ".fas/tasks/implement-typed-retained-node-refs-and-move-safe-resource-li.md",
    "docs/architecture.md",
    "docs/v3-api-consistency.md",
    "docs/shared-architecture-model.md"
  ]
}
```

## Affected files
- packages/ignite-core/src/RenderArgs.ts
- packages/ignite-adapters/src/types.ts
- packages/ignite-element/src/createProjectionFactory.ts
- packages/ignite-element/src/runtime/effects.ts
- packages/ignite-element/src/igniteCore/types.ts
- packages/ignite-element/src/tests
- README.md
- packages/ignite-element/README.md
- docs/site/src/content/docs
- .changeset
- packages/ignite-element/src/igniteCore/types.ts
- packages/ignite-element/src/tests/testing.test.ts
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- packages/ignite-element/src/igniteCore/createIgniteComponentFactory.ts
- packages/ignite-element/src/tests/IgniteCore.test.ts
- packages/ignite-element/src/tests/types/testing.types.test.ts

## Scope Amendments

- Type: dependency-reachable public type propagation
  - Added at: 2026-07-26
  - Trigger: the initial red/green implementation pass showed the narrowed callback types must propagate through the public core and element type aliases.
  - Reason: `packages/ignite-core/src/types.ts` and `packages/ignite-element/src/RenderArgs.ts` re-export and specialize the callback types changed in `packages/ignite-core/src/RenderArgs.ts`; leaving them unchanged would preserve stale public generics or break typecheck.
  - Evidence source: tests-first implementation checkpoint
  - Evidence paths: `packages/ignite-element/src/tests/types/igniteCore.types.test.ts`, `packages/ignite-element/src/tests/types/testing.types.test.ts`
  - Accuracy signal: direct compiler failures and dependency-reachable imports
  - Result: the compiler-guided pass ultimately preserved compatibility without changes in `packages/ignite-core/src/types.ts` or `packages/ignite-element/src/RenderArgs.ts`; both are intentionally unchanged and removed from the final change envelope.
- Type: dependency-reachable adapter type propagation
  - Added at: 2026-07-26
  - Trigger: the narrowed core callback generics produced compiler errors in the shared adapter definitions.
  - Reason: `packages/ignite-adapters/src/types.ts` and `packages/ignite-adapters/src/xstate.ts` instantiate the old command/effect generic signatures; they must propagate the same public contract for the workspace to compile.
  - Evidence source: compiler-guided implementation checkpoint
  - Evidence paths: `packages/ignite-adapters/src/types.ts`, `packages/ignite-adapters/src/xstate.ts`
  - Accuracy signal: direct `TS2707` failures plus exhaustive `FacadeCommandsCallback` and `FacadeEffectsObjectCallback` reference search
  - Result: only `packages/ignite-adapters/src/types.ts` required a final signature change; `packages/ignite-adapters/src/xstate.ts` remained compatible and is intentionally unchanged.
- Type: final change-envelope contraction
  - Added at: 2026-07-27
  - Trigger: green root validation reported four missing planned files after the compiler-guided implementation had already reverted unnecessary propagation edits.
  - Reason: final ChangeSet truth must describe implemented files, not force no-op changes. The broad `packages/ignite-element/src/igniteCore` path is narrowed to `packages/ignite-element/src/igniteCore/types.ts`; `createIgniteComponentFactory.ts` is intentionally unchanged.
  - Evidence source: `fas validate-task` closeout-readiness hold
  - Evidence paths: `.fas/state/closeout-readiness/latest.json`, `.fas/state/downstream-context/latest.json`
  - Accuracy signal: zero unexpected files, 15 implemented files, and exactly four missing planned files, all confirmed unnecessary by the final compiler/test passes
  - Follow-up: refresh active scope and rerun the narrow orchestration confirmations before root validation.

- Type: scope-refresh-promotion
- Added at: 2026-07-27
- Trigger: dirty-low-confidence-scope
- Reason: Promoted dirty low-confidence or dependency-reachable task-packet path(s) into affected scope.
- Added paths: packages/ignite-element/src/igniteCore/types.ts, packages/ignite-element/src/tests/testing.test.ts, packages/ignite-element/src/tests/types/igniteCore.types.test.ts, packages/ignite-element/src/igniteCore/createIgniteComponentFactory.ts, packages/ignite-element/src/tests/IgniteCore.test.ts, packages/ignite-element/src/tests/types/testing.types.test.ts
- Evidence source: task-packet dirty scope promotion
- Evidence: task-packet dirty scope promotion | .fas/state/task-packet.json | Promoted dirty path(s): packages/ignite-element/src/igniteCore/types.ts, packages/ignite-element/src/tests/testing.test.ts, packages/ignite-element/src/tests/types/igniteCore.types.test.ts, packages/ignite-element/src/igniteCore/createIgniteComponentFactory.ts, packages/ignite-element/src/tests/IgniteCore.test.ts, packages/ignite-element/src/tests/types/testing.types.test.ts
- Accuracy signal: Path was dirty in git status and present in task-packet low-confidence/dependency-reachable scope.

## Implementation plan

1. Add failing public type, headless, and runtime tests first. Reject `host` in commands, reject `actor` and `host` in effects, reject promise-returning effects, and preserve `emit`, `select`, `snapshot`, and `prevSnapshot`. Record the expected red result before changing production code.
2. Narrow `RenderArgs` and projection/runtime assembly. Keep the host internal for event dispatch and error routing, and fail closed through that existing error path if an untyped JavaScript effect returns a thenable.
3. Migrate package wrappers, tests, real examples, current API docs, and migration notes in one coordinated beta cutover. Replace host-derived command data with explicit inputs, host-written presentation with state/view/render or retained presentation, and async effect feedback with source-native behavior. Add the breaking beta changeset and verify source-emitted events and Redux or MobX effect bridges remain intact.
4. Perform only scope-bound cleanup revealed by the migration; do not add replacement host capabilities or fold routing, provisioning, retained ref/commit, or Ignite Alchemy work into this task.

## Verification plan

- Run focused core type tests, effect runtime tests, emitted-event bridge tests, and pure-Node headless tests.
- Run package typechecks, example typechecks, docs code-example checks, and export verification.
- Run fas validate-task and full verification because this is a pre-stable shared public contract change.

## Risks

- Removing actor from effects may expose undocumented consumers that use effects as a feedback loop.
- Internal host error handling could accidentally be removed along with the public host property.
- A partial docs or example migration would leave conflicting stable guidance.

## Dependencies

- Depends on task-1784909239951 architecture standard.
- Blocks task-1784909335843 conformance and public API verdict.

## Open questions

- None; any newly discovered legitimate host mutation use case must return to architecture rather than reintroducing the generic escape hatch during implementation.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
