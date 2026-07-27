# Define the canonical source-native provisioning and host-boundary architecture standard

## Source

Created with `fas create-task` on 2026-07-24.

## Problem

Write the normative architecture decision for environmental integration in
Ignite applications. Define capability ports, environment adapters, and
source-native binding through XState `provide` and actor composition, Redux
middleware or thunk injection, MobX constructors or factories, Actor-Web
composition, and equivalent custom-source APIs. The canonical result is the
exact native source, passed directly to `igniteCore`. Native source lifecycles
own environmental listeners, subscriptions, timers, cancellation, and
shutdown. Explicitly reject `createFeature`, `Feature` wrappers, generic
lifecycle containers, `driver`, `igniteEnvironment`, ports on `igniteCore`,
host mutation from commands, environmental I/O in Ignite effects, and retained
Canvas or Cytoscape ownership in effects. Preserve retained `ref` and `commit`
as the separate presentation lifecycle and label current facts, accepted
targets, compatibility impact, and evidence gates.

## Acceptance criteria

- A normative document defines one vocabulary and responsibility matrix for
  functional core, port, adapter, provided implementation, exact native source,
  projection, command, effect, retained resource, host, and native lifecycle.
- The canonical composition flow is ports to source-library-native provisioning
  to exact source to `igniteCore`, with no `Feature` wrapper or `createFeature`
  API.
- Idiomatic XState, Redux, MobX, Actor-Web, browser, Node, deterministic fake,
  Canvas, and Cytoscape mappings use native source construction and lifecycle
  semantics without claiming unshipped APIs are current.
- The decision records lifecycle ownership for isolated machines or factories
  versus shared live actors, stores, observables, Actor-Web sources, and custom
  sources.
- The decision rejects driver, environment, ports, provide hooks, disposal
  policy, source wrappers, and lifecycle containers on `igniteCore`.
- Commands express source intent; effects publish outward post-render facts;
  neither owns host mutation, source cleanup, or retained presentation
  resources.
- `ref` acquires and cleans up node-bound retained resources and `commit`
  synchronizes projected data after reconciliation; neither creates, wraps,
  stops, or disposes the source.
- Existing architecture and v3 API indexes link to the normative decision
  without duplicating its contract.
- Headless guidance binds deterministic or Node adapters through native source
  APIs and requires no DOM or Ignite-specific environment runtime.
- TDD and DDD guardrails remain satisfied, with architecture and documentation
  verification before downstream implementation.

## Proposed solution

- Establish `docs/source-native-provisioning.md` as the normative decision for
  the source-only flow:
  `capability ports -> source-native binding -> exact source -> igniteCore`.
- Preserve each source ecosystem’s public API and lifecycle. XState owns actors,
  invoked callback cleanup, and `stop`; Redux owns store construction,
  middleware, thunks, and application shutdown conventions; MobX owns
  constructor or factory injection and store disposal; Actor-Web owns source,
  transport, and runtime lifecycle.
- Keep `igniteCore` projection-only. It consumes the exact supported source and
  gains no environment, dependency-injection, source provisioning, or
  application-disposal surface.
- Define commands as intent sent to the native source and effects as synchronous
  outward-fact publication after accepted transitions.
- Keep node-bound retained presentation separate: `ref` owns acquisition and
  cleanup for Canvas, Cytoscape, editors, observers, node listeners, and local
  draw queues; `commit` synchronizes the current projection after reconciliation.
- Mark every example and contract as current, accepted target, or evidence-gated
  implementation so callback narrowing and retained directives are not
  described as shipped before their implementation tasks land.

## Alternatives considered

- Add `driver`, `igniteEnvironment`, or `ports` to `igniteCore`: rejected because
  it creates a second dependency-injection runtime beside each source library.
- Return `{ source, dispose }` from a public `createFeature` helper: rejected
  because consumers need the exact source, native libraries already define
  construction and lifecycle, and `feature.source` adds wrapper ceremony.
- Mutate or proxy a source to add standardized disposal: rejected because it can
  break source identity, native type inference, frozen objects, and ownership.
- Hide disposal in a global registry keyed by source: rejected because lifecycle
  ownership becomes implicit and ambiguous.
- Let commands or effects mutate the host: rejected because commands precede
  source acceptance and effects are outward fact publication, not an imperative
  runtime.
- Own Canvas, Cytoscape, router, or transport lifecycles in effects: rejected
  because source-environment resources belong to native source lifecycle while
  retained node resources belong to `ref` and `commit`.
- Put shared router ownership in `igniteShell`: rejected because `igniteShell`
  is a narrow sourceless element-lifecycle helper, not a source composition root.

## Architecture Context

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

- docs/source-native-provisioning.md
- docs/architecture.md
- docs/v3-api-consistency.md
- docs/shared-architecture-model.md
- .mock-studio/ignite-story-workbench/receipts/measurements.json

## Scope Amendments

- Rejected the previously accepted `createFeature({ ports, setup })` helper after
  manual router composition showed that it added a second lifecycle abstraction,
  wrapper vocabulary, and `feature.source` ceremony. The task now standardizes
  exact source-only provisioning and native lifecycle ownership.
- Closeout isolation of the unrelated Ignite Alchemy work restored the tracked
  baseline version of its measurements receipt, revealing a repository-wide
  Biome formatting failure. The receipt receives whitespace-only formatting so
  the current task can verify independently; all semantic Alchemy changes remain
  preserved for `task-1784655399770`.

## Implementation plan

- Inventory current source ownership, callback, headless, `igniteShell`,
  retained `ref` and `commit`, routing, Redux, MobX, Actor-Web, and Voice
  Workbench facts.
- Rewrite the normative decision around exact source-only composition and native
  lifecycle ownership; remove `Feature`, `createFeature`, setup, `onDispose`, and
  generic disposal-state-machine language.
- Link architecture indexes to the corrected decision and reconcile
  contradictory host, effect, lifecycle, and retained-presentation language
  without changing production code.

## Verification plan

- Run markdown lint and documentation code-example checks.
- Run architecture contract checks and search current architecture surfaces for
  stale wrapper-first guidance.
- Obtain independent review focused on exact source identity, native lifecycle
  ownership, headless operation, callback boundaries, and retained `ref` and
  `commit` separation.

## Risks

- Source-only guidance could imply that deterministic sources may import concrete
  host APIs instead of binding ports through native composition.
- Lifecycle cleanup could become underspecified unless each source ecosystem
  names its native owner.
- `ref` and `commit` could be mistaken for general environment provisioning
  unless the source-versus-presentation boundary stays explicit.
- Current committed architecture documents describe the rejected helper and must
  be revised before this task closes.

## Dependencies

- Foundation task for callback-contract, routing-dogfood, and cross-adapter
  dogfood slices.
- No production implementation begins until the corrected source-only
  architecture standard is accepted.
- Final public guidance also waits for retained `ref` and `commit`
  implementation so it documents shipped presentation syntax.

## Open questions

- None. The owner accepted exact source-only provisioning and rejected
  `createFeature`; downstream evidence may refine ecosystem-specific lifecycle
  guidance but may not introduce another wrapper without a new architecture
  decision.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
