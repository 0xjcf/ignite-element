# Source-Native Provisioning And Host Boundaries

## Status

Normative architecture decision.

## Legend

- `Current fact`: implemented and evidenced in this repository today.
- `Accepted target`: agreed contract that downstream work should implement.
- `Evidence-gated implementation`: intended public implementation that is not
  shipped yet and must not be described as current.

## Purpose

This document fixes the architecture vocabulary and responsibility boundary for
environmental integration in Ignite applications.

The decision is:

- source libraries keep ownership of source creation and dependency binding
- applications provide concrete environment adapters through capability ports
- `igniteCore(...)` receives the already-bound source only
- commands express source-directed intent
- effects publish outward post-render transition facts
- retained Canvas, Cytoscape, and similar resources stay in presentation-owned
  ref or commit code

This document is the normative contract. Companion summaries live in
[`docs/architecture.md`](./architecture.md),
[`docs/shared-architecture-model.md`](./shared-architecture-model.md), and
[`docs/v3-api-consistency.md`](./v3-api-consistency.md).

## Vocabulary

| Term | Meaning | Status |
| --- | --- | --- |
| Functional core | Deterministic domain behavior that depends only on declared capability ports and source-library semantics | `Current fact` |
| Port | A capability interface consumed by deterministic behavior. Reserve `port` for capability contracts, not Ignite callbacks or render args. | `Accepted target` |
| Adapter | A concrete browser, Node, test, or transport implementation of a port | `Current fact` |
| Provided implementation | The concrete adapter instance selected by the consuming application and bound through the source library's native composition mechanism | `Accepted target` |
| Bound source | The machine, store, observable, actor-web source, or equivalent source object after concrete implementations have already been wired in | `Current fact` |
| Feature | The composition result returned by `createFeature({ ports, setup })`, containing the already-bound source and explicit disposal | `Accepted target` |
| Projection | Ignite's derived render/runtime surface built from snapshots, commands, schema metadata, and outward facts | `Current fact` |
| Command | Source-directed intent issued before the source accepts or rejects the transition | `Current fact` |
| Effect | A post-render transition fact published outward after the source transition has already occurred | `Accepted target` |
| Retained resource | An identity-bearing imperative presentation resource such as Canvas, WebGL, Cytoscape, editors, or observers | `Current fact` |
| Host | The concrete environment surface around a mounted projection, including DOM element access today | `Current fact` |
| Disposal | Explicit application-owned cleanup for the feature and any resources registered during setup | `Accepted target` |

## Responsibility Matrix

| Surface | Owns | Does not own | Status |
| --- | --- | --- | --- |
| Application domain source | Behavior, policy, commands, transitions, and capability usage | Concrete browser, Node, transport, Canvas, or DOM APIs | `Current fact` |
| Application shell | Adapter selection, feature composition, feature disposal, shared versus isolated ownership decisions | Ignite runtime internals or source-library transition semantics | `Accepted target` |
| Source-library composition | Native binding via XState `provide`, Redux construction or middleware/thunk injection, MobX constructors/factories, Actor-Web composition, or equivalent custom source-native APIs | Ignite-specific DI containers | `Current fact` |
| `igniteCore(...)` | Projection assembly from the bound source plus command/effect/schema callbacks | Ports, drivers, `igniteEnvironment`, feature wrappers, or disposal policy | `Current fact` |
| Ignite effects | Outward post-render transition facts | Host mutation, transport I/O, retained-resource ownership, listener lifetime | `Accepted target` |
| Presentation ref/commit code | Retained DOM-adjacent identity, acquisition, updates, and cleanup | Domain truth, commands, or source lifecycle authority | `Current fact` |
| `igniteShell` | Narrow sourceless composition-root lifecycle where no source exists | Source provisioning or environment integration | `Current fact` |

## Canonical Composition Boundary

The accepted composition API is direct `createFeature({ ports, setup })`.

```text
type FeatureTeardown = () => void | PromiseLike<void>;

type SetupContext<Ports> = {
  readonly ports: Readonly<Ports>;
  onDispose(teardown: FeatureTeardown): void;
};

type Feature<Source> = {
  readonly source: Source;
  dispose(): Promise<void>;
};

createFeature({
  ports,
  setup({ ports, onDispose }) {
    // bind concrete implementations through the source library here
    return source;
  },
});
```

```text
Accepted target / evidence-gated package placement:
  import { createFeature } from "@ignite-element/core";
```

Fixed decisions:

- Top-level `ports` is always required. Portless features pass `{}`. There is no
  overload that omits `ports`.
- `setup` receives `{ readonly ports: Readonly<Ports>; onDispose(teardown): void }`.
- Readonly is shallow only. Nested mutation policy remains the application's
  responsibility.
- `onDispose(...)` may be called only during the synchronous `setup(...)`
  window. A late call throws an `Error` whose message starts with
  `createFeature onDispose() called after setup closed`.
- `createFeature(...)` is the composition boundary. `igniteCore(...)` accepts the
  bound source only and does not accept the `Feature` wrapper.
- Feature-specific wrappers such as `createRouterFeature(...)` are optional
  convenience factories for repeated reuse, not mandatory ceremony.

## Setup And Disposal Contract

### Setup

- `setup(...)` returns the bound source synchronously.
- If `setup(...)` throws after registering synchronous teardowns, those
  teardowns roll back immediately in LIFO order.
- Async rollback during setup failure is unsupported. If a registered teardown
  returns a thenable during setup rollback, Ignite must not await it or describe
  it as transactional recovery. Instead it contributes a contract-violation
  `Error` after the original setup error in the final `AggregateError`.
- If setup fails and rollback also fails:
  - setup-only failure rethrows the original setup error
  - setup plus one rollback failure throws an `AggregateError` with the setup
    error first
  - setup plus multiple rollback failures also throws an `AggregateError` with
    the setup error first and rollback failures in LIFO encounter order

### Dispose

- Lifecycle states are `active -> disposing -> disposed | dispose_failed`.
- `dispose()` memoizes one promise. Concurrent callers observe the same promise.
- Disposal runs sequentially in LIFO order and attempts every registered
  teardown.
- There is no implicit retry.
- One teardown failure preserves and rejects with the original error.
- Multiple teardown failures reject with `AggregateError`.
- After `dispose_failed`, every later `dispose()` call returns the exact same
  rejected `Promise` object and never re-runs cleanup.
- The source remains readable after disposal. Disposal does not imply
  stop/close/unsubscribe/abort unless a registered teardown performs that work
  explicitly.

## Source-Native Provisioning Patterns

The binding point belongs to the source library or source-owning application
code, not to Ignite.

### XState

```text
Current fact:
  const machine = createMachine(...);
  const component = igniteCore({ adapter: "xstate", source: machine, ... });

Accepted target:
  const feature = createFeature({
    ports: { clock, navigate },
    setup({ ports }) {
      return machine.provide({
        actions: {
          navigateToDashboard: () => ports.navigate("/dashboard"),
        },
      });
    },
  });

  igniteCore({ adapter: "xstate", source: feature.source, ... });
```

### Redux

```text
Accepted target:
  createFeature({
    ports: { api, clock },
    setup({ ports, onDispose }) {
      const store = configureStore({
        reducer,
        middleware: (getDefaultMiddleware) =>
          getDefaultMiddleware({
            thunk: { extraArgument: ports },
          }),
      });
      onDispose(() => store.dispatch(shutdown()));
      return store;
    },
  });
```

### MobX

```text
Accepted target:
  createFeature({
    ports: { storage },
    setup({ ports, onDispose }) {
      const store = new SessionStore({ storage: ports.storage });
      onDispose(() => store.dispose());
      return store;
    },
  });
```

### Actor-Web

```text
Accepted target:
  createFeature({
    ports: { transport },
    setup({ ports }) {
      return createActorWebSource({
        transport: ports.transport,
      });
    },
  });
```

### Browser

```text
Accepted target:
  const navigationAdapter =
    typeof window !== "undefined" && "navigation" in window
      ? window.navigation
      : undefined;

  createFeature({
    ports: {
      navigation: navigationAdapter,
      storage,
      fetchJson,
      clock,
    },
    setup({ ports, onDispose }) {
      if (ports.navigation) {
        const handleNavigate = (event) => {
          // translate browser navigation facts into the source boundary here
        };

        ports.navigation.addEventListener("navigate", handleNavigate);
        onDispose(() =>
          ports.navigation.removeEventListener("navigate", handleNavigate),
        );
      }

      return createAppSource(ports);
    },
  });
```

Use a capability such as `navigation?: Navigation` or a narrower wrapper so the
application shell selects the concrete host adapter first, the source stays
DOM-free, and setup uses only the provided port.

### Node

```text
Accepted target:
  createFeature({
    ports: { readFile, writeFile, fetchJson, clock, processEvents },
    setup({ ports, onDispose }) {
      const handleSigint = () => {
        // project shutdown intent into the source-owned boundary here
      };

      ports.processEvents.on("SIGINT", handleSigint);
      onDispose(() => ports.processEvents.off("SIGINT", handleSigint));
      return createAppSource(ports);
    },
  });
```

### Deterministic fake

```text
Accepted target:
  createFeature({
    ports: {
      navigate: fakeNavigate,
      storage: fakeStorage,
      fetchJson: fakeFetchJson,
      clock: fakeClock,
      subscriptions: fakeSubscriptions,
    },
    setup({ ports, onDispose }) {
      const subscription = ports.subscriptions.open("navigation");
      onDispose(() => subscription.close());
      return createAppSource(ports);
    },
  });
```

The Node and deterministic-fake cases use the same port shape discipline as the
browser case: concrete environment capabilities are application-selected,
cleanup is explicit, and Ignite still receives only the bound source.

### Port-shape parity summary

```text
Accepted target:
  type AppPorts = {
    fetchJson: FetchJsonPort;
    clock: ClockPort;
    navigate?: NavigatePort;
    readFile?: ReadFilePort;
    writeFile?: WriteFilePort;
  };

  // browser: navigate + fetchJson + clock
  // node: readFile + writeFile + fetchJson + clock
  // fake: same shape, fake implementations
```

The pattern is the same in every environment: choose concrete adapters at the
application boundary, bind them through source-native composition, then pass the
bound source into Ignite.

## Isolated Versus Shared Ownership

Whether a source is isolated or shared is decided by the source library or the
application/source library wrapper, not by Ignite.

| Ownership mode | Owner | Example | Status |
| --- | --- | --- | --- |
| Isolated source per mount or request | Source factory or application shell | New XState machine, Redux store, or MobX store per feature instance | `Current fact` |
| Shared live source | Application shell or source library | Shared actor-web source, shared Redux store, shared observable singleton | `Current fact` |
| Feature disposal ownership | Application shell | Calls `feature.dispose()` when the owning lifecycle ends | `Accepted target` |

Ignite consumes the resulting source either way. It does not arbitrate isolated
versus shared ownership.

## Commands, Effects, And Host Boundaries

Commands are source-directed intent. Effects are outward post-render transition
facts.

Fixed decisions:

- Do not use `port` to describe Ignite callback arguments such as
  `commands({ actor, command, host })` or render args.
- Do not mutate host or environment state directly from commands.
- Do not perform environmental I/O in Ignite effects.
- Current physical `host` callback access is compatibility behavior in the
  shipped surface. It is not the accepted target host-integration architecture.
- Effects remain outward-fact publication only. The host may observe those facts
  and perform imperative work outside Ignite.

## Retained Canvas And Cytoscape Boundary

Retained resources keep stable identity outside effects and outside source
provisioning.

See [`docs/retained-complex-interfaces.md`](./retained-complex-interfaces.md)
for the fuller retained-interface contract.

- Canvas, WebGL, Cytoscape, editors, maps, and similar retained resources belong
  to presentation-owned ref or commit code.
- Retained renderer identity and cleanup belongs to consumer presentation code,
  not to `createFeature(...)`, commands, or Ignite effects.
- Ignite may project the state that retained presentation code consumes, but it
  does not own the retained resource lifecycle.

```text
Compact mapping:
  ref(element) -> acquire retained identity
  commit(element, projectedState) -> update retained resource
  cleanup() -> dispose retained resource
```

## `igniteShell` Boundary

`igniteShell` is already a narrow shipped public helper/surface for sourceless
composition-root lifecycle. It is not the provisioning API for source-native
environment binding.

- Use `igniteShell` when there is no source and the need is composition-root
  mount/unmount behavior.
- Do not treat `igniteShell` as a substitute for `createFeature(...)` or as a
  host-environment container.

## Packaging Decision

- Canonical DOM-free import: `@ignite-element/core`
- Optional `ignite-element` convenience re-export: unshipped and
  evidence-gated

Any future convenience re-export must not make the core implementation
DOM-dependent or obscure the canonical DOM-free surface.

## Rejected Alternatives

| Alternative | Rejection |
| --- | --- |
| Add `driver`, `igniteEnvironment`, or `ports` to `igniteCore(...)` | Creates an Ignite-specific dependency-injection runtime and collapses the source boundary. |
| Treat `createSourceRuntime(...)` as the primary public vocabulary | Hides the feature composition boundary and makes ports/setup look incidental. |
| Let commands mutate host or environment directly | Breaks command-as-intent and mixes behavior with imperative shell work. |
| Let Ignite effects own network, storage, routing, or retained resources | Breaks the post-render fact boundary and turns effects into a second imperative runtime. |
| Make `ports` optional or provide a portless overload | Produces signature drift and weakens the one canonical composition shape. |
| Deep-freeze ports | Over-specifies implementation and adds policy that belongs to the application. |
| Allow `onDispose(...)` after setup returns | Makes teardown registration timing ambiguous and complicates deterministic rollback semantics. |
| Put retained Canvas or Cytoscape lifecycle into effects | Destroys retained identity guarantees and conflates projection with presentation resource ownership. |

## Evidence Gates

The following are accepted targets, not current shipped claims:

- public `createFeature({ ports, setup })` helper
- its disposal state machine and error contract
- package placement and export surface for that helper
- any convenience re-export from `ignite-element`
- docs/examples that show direct feature composition as executable current API

Required evidence before claiming shipment:

1. public implementation in the agreed package surface
2. conformance tests for setup failure, late `onDispose`, LIFO rollback,
   memoized disposal, and error aggregation
3. cross-adapter dogfood for XState, Redux, MobX, Actor-Web, browser, Node, and
   deterministic fake flows
4. docs and migration updates that preserve current-fact versus target-state
   labeling

## Cross-Reference Summary

- [`docs/architecture.md`](./architecture.md): package-family architecture and
  ownership summary
- [`docs/shared-architecture-model.md`](./shared-architecture-model.md):
  ADR-003 alignment and cross-repo evidence posture
- [`docs/v3-api-consistency.md`](./v3-api-consistency.md): API vocabulary index
  and the placement of this decision among other v3 contract passes
