# Refactor routing examples to source-native navigation ports and XState provisioning

## Source

Created with `fas create-task` on 2026-07-24.

## Problem

Replace the routing examples' split History API coordination with an
application-owned XState source backed by the browser Navigation API. Keep the
machine independent of DOM globals and Ignite, but avoid a generic router or
capability framework: use one example-local thin navigation boundary, a modern
browser implementation, and a deterministic memory implementation. Bind
external navigation observation and accepted navigation commits through the
router source's native XState lifecycle, pass the exact started actor directly
to `igniteCore`, and remove History writes from Ignite effects and commands.
Preserve deep links, guards, canonicalization, parent-child ownership, emitted
facts, headless behavior, and cleanup through `routerSource.stop()`.

## Purpose and migration model

The task proves the callback and source-ownership architecture in the two
routing examples without creating a public Ignite router abstraction.

Today the SPA router accepts intent in XState but performs the browser write
later from an Ignite effect:

```ts
const defineRouter = igniteCore({
  source: routerActor,
  commands: ({ actor }) => ({
    navigate: (to: string) => actor.send({ type: "NAVIGATE", to }),
  }),
  effects: ({ snapshot, prevSnapshot }) => {
    if (
      snapshot.context.source === "navigate" &&
      snapshot.context.path !== prevSnapshot.context.path
    ) {
      pushPath(snapshot.context.path);
    }
  },
});
```

The nested example has the inverse problem: its command helper writes History
before the machine accepts, rejects, redirects, or canonicalizes the request.

```ts
navigate(to: string) {
  updateBrowserPath(target, to);
  actor.send({ type: "NAVIGATE", to });
}
```

After this task, commands send intent only. The application-owned router source
resolves the route, commits the accepted destination through a thin Navigation
API adapter, and owns observation cleanup through XState:

```ts
const routerSource = createRouterSource({
  navigation: createBrowserNavigation(window.navigation),
});

const defineRouter = igniteCore({
  source: routerSource,
  view: ({ snapshot }) => ({
    route: snapshot.context.route,
    path: snapshot.context.path,
  }),
  commands: ({ actor }) => ({
    navigate: (to: string) =>
      actor.send({ type: "NAVIGATE_REQUESTED", to }),
  }),
});
```

The example-local boundary stays deliberately small:

```ts
interface NavigationPort {
  currentPath(): string;
  observe(listener: (path: string) => void): () => void;
  commit(path: string, history: "push" | "replace"): Promise<void>;
}
```

The browser implementation uses `window.navigation`, `navigate` interception,
and `navigation.navigate(...)`. The memory implementation supplies the same
behavior without DOM globals. The browser adapter tags source-originated
commits so its own `navigate` event does not feed back into the machine.

## Acceptance criteria

- Router machines import no `window`, `navigation`, History API, Ignite, or
  browser-adapter modules and declare only the minimal named implementation
  slots needed by the example-owned source factory.
- The browser adapter uses the Navigation API rather than
  `history.pushState`, `history.replaceState`, or `popstate`; it filters
  non-interceptable, cross-origin, hash-only, and download navigations
  appropriately.
- The examples explicitly document that the browser adapter requires Navigation
  API support (Baseline 2026); no History API fallback is introduced.
- A minimal example-local `NavigationPort` and deterministic memory
  implementation preserve headless execution without DOM shims or global
  augmentation. Any temporary Navigation API structural types remain local to
  the example until TypeScript ships the DOM declarations used here.
- Every environmental listener cleanup is exercised through
  `routerSource.stop()` and the native XState lifecycle.
- Accepted user navigation commits only after machine decision; external
  navigation feeds explicit source events; rejection, canonical replace,
  duplicate-write, self-originated-event suppression, and navigation failure
  semantics are tested.
- Ignite router components contain projection, commands, rendering, and
  optional outward facts only; they perform no browser navigation work in
  commands or effects.
- Shared router actors are application-owned exact XState sources passed directly to igniteCore; no Feature wrapper, createFeature helper, or Ignite lifecycle container is introduced.
- Isolated provided-machine tests retain Ignite-owned adapter lifecycle semantics while application-owned live actors retain native XState ownership.
- SPA and nested-child routing docs teach createRouterSource as example-owned source composition, not a public Ignite router abstraction.
- Headless tests use deterministic ports with the same router source factory and no DOM globals.
- TDD and DDD guardrails remain satisfied and the task stays in the live dependency graph.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution

- Define only the example-local `NavigationPort` operations the examples use:
  current path, navigation observation with cleanup, and accepted push or
  replace commit. Implement it with the browser Navigation API and a
  deterministic in-memory adapter.
- Keep Navigation API compatibility typing local and structural. Do not add a
  repository-wide DOM augmentation or expose the browser API through Ignite.
- Declare one named XState observation actor and one accepted-navigation commit
  implementation, then bind them with `machine.provide(...)` before actor
  creation. Route commit rejection into an explicit machine fact rather than
  leaking an unhandled promise. The machine stays browser- and Ignite-agnostic.
- Expose an example-owned `createRouterSource({ navigation })` composition
  function that returns the exact started actor. Model navigation observation as
  an invoked or spawned callback actor whose returned cleanup runs when the
  router actor stops.
- Pass `routerSource` directly to `igniteCore` and use `routerSource.stop()` as
  the application-owned native lifecycle boundary for HMR, tests,
  microfrontends, and other bounded owners.
- Remove History calls from Ignite effects. Router elements project route state, send navigation intent through commands, and optionally publish outward facts after accepted transitions.

## Alternatives considered

- Preserve effect-driven History writes: rejected because it splits navigation authority between source state and projection callbacks and makes listener cleanup dependent on element lifecycle.
- Write History directly from commands: rejected because commands run before the state machine has accepted, rejected, redirected, or canonicalized the navigation request.
- Import `window.navigation` directly into the router machine: rejected because
  it couples the functional core to DOM infrastructure and forces headless tests
  to polyfill the browser.
- Build a generic navigation capability framework: rejected because these
  examples need only current path, observation, accepted commit, and a memory
  implementation.
- Add a History API fallback: rejected for this example because the Navigation
  API is Baseline 2026 and the fallback would double the lifecycle code while
  obscuring the source-ownership lesson. The documented browser requirement
  remains explicit.
- Add an Ignite router, driver, or environment API: rejected because routing composition is already expressible through XState provisioning and application-owned source lifecycle.
- Add a generic `{ source, dispose }` wrapper: rejected because XState already
  provides actor identity, invoked-resource cleanup, and `stop`; Ignite should
  receive that actor directly.
- Put shared router ownership in `igniteShell.onConnect`: rejected because element connection is shorter-lived than a shared application source and nested consumers must not stop a router they did not create.

## Architecture Context

This task inherits the normalized architecture context accepted by
`task-1784909239951`. The Navigation API revision narrows the browser adapter;
it does not change the accepted ownership or execution axes.

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

- examples/apps/spa-router/src
- examples/apps/spa-router/README.md
- examples/apps/nested-child-router/src
- examples/apps/nested-child-router/README.md
- docs/site/src/content/docs/guides/routing.mdx

## Reference files

These inherited architecture surfaces are read-only evidence for the accepted
ownership boundary. They are not implementation deliverables for this task.

- docs/architecture.md
- docs/shared-architecture-model.md
- docs/v3-api-consistency.md
- .fas/tasks/define-the-canonical-source-native-provisioning-and-host-bou.md

## Scope Amendments

- None.

## Implementation plan

1. Add failing characterization tests for deep links, accepted navigation,
   external Navigation API events, guard rejection, canonical replace,
   duplicate suppression, source-originated event suppression, commit failure,
   emitted facts, actor stop, and listener cleanup. Preserve equivalent
   deterministic coverage in both examples.
2. Add the minimal Navigation API structural types, thin browser adapter, and
   memory adapter. Bind one observation actor and accepted-commit implementation
   through `machine.provide(...)`, converting commit rejection into an explicit
   source fact.
3. Return the exact started actor from an example-owned
   `createRouterSource({ navigation })`, pass it directly to `igniteCore`, and
   ensure `routerSource.stop()` removes the Navigation API listener.
4. Remove History API helpers and all browser writes from Ignite commands and
   effects. Migrate both READMEs and the routing guide to teach the modern
   browser requirement, application ownership, and deterministic headless path.

## Verification plan

- Run focused router machine, headless, Navigation API interception,
  accepted-commit, failure, actor-stop, and cleanup tests.
- Run example typecheck and build lanes plus docs code-example verification.
- Run architecture checks, fas validate-task, and full verification for the cross-example lifecycle change.

## Risks

- Calling `navigation.navigate(...)` before accepted machine state would restore split authority.
- Source-originated commits also dispatch `navigate`; incorrect tagging or
  filtering could create a feedback loop.
- Navigation transition promise rejection could become unhandled unless the
  adapter and provided source convert it into an explicit fact.
- A callback actor not owned by the router source could leak its Navigation API listener after actor.stop.
- Stopping a shared actor from element disconnect would violate application ownership.
- Consumers on browsers older than the documented Baseline 2026 requirement
  need a separate adapter; this example intentionally supplies no fallback.

## Dependencies

- Depends on task-1784909239951 corrected source-only architecture standard.
- Supersedes task-1784253036241 because source-native provisioning replaces host-owned History effects.
- Blocks task-1784909335843 exact-source conformance.

## Open questions

- During architecture planning, choose the smallest XState-native commit seam
  that consumes `navigation.navigate(...).committed` or `.finished` without
  leaking rejection. Prefer one provided implementation; introduce a dedicated
  commit actor only if cancellation or result ordering requires it.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
