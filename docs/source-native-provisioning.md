# Source-Native Provisioning And Host Boundaries

## Status

Normative architecture decision.

## Purpose

This document defines the accepted Ignite boundary for source provisioning,
environmental integration, and lifecycle ownership.

The decision is:

- applications and source ecosystems own source construction, dependency
  binding, sharing, and shutdown
- `igniteCore(...)` receives the already-configured exact native source only
- commands are source-directed intent
- effects are outward post-transition facts
- retained Canvas, Cytoscape, editor, and similar resources remain
  presentation-owned
- Actor-Web remains projection-only from Ignite's point of view; runtime,
  admission, authorization, receipts, checkpoints, replay, reconciliation, and
  transport lifecycle remain Actor-Web-owned

Rejected directions are not accepted targets here:

- no `createFeature(...)`
- no `Feature` wrapper
- no `feature.source`
- no `onDispose(...)`
- no Ignite-owned disposal container
- no `ports`, `driver`, `environment`, or `igniteEnvironment` config on
  `igniteCore(...)`

## Legend

- `Current fact`: implemented and evidenced in this repository today.
- `Current decision`: accepted contract enforced by current tests, checks, and
  task evidence.
- `Future work`: not yet shipped here and must not be described as current.

## Vocabulary

| Term | Meaning | Status |
| --- | --- | --- |
| Functional core | Deterministic source behavior that depends only on source state and application-selected capability bindings | `Current fact` |
| Source-native composition | Binding concrete browser, Node, persistence, transport, or test implementations through the source ecosystem's own construction seam | `Current decision` |
| Exact source | The machine, store, observable, Actor-Web source, or equivalent source object after application-owned composition has already happened | `Current decision` |
| Projection | Ignite's derived render and runtime surface built from source snapshots, commands, schema metadata, and outward facts | `Current fact` |
| Command | Source-directed intent issued against the exact source | `Current fact` |
| Effect | An outward post-transition fact published after the source has already moved | `Current fact` |
| Host | The concrete mounting or runtime surface around a projection, including DOM and headless hosts | `Current fact` |
| Native lifecycle | The source ecosystem's own unsubscribe, stop, close, abort, shutdown, or disposal semantics | `Current decision` |
| Presentation cleanup | Ref-, commit-, or renderer-owned cleanup for retained presentation resources | `Current decision` |

## Responsibility Matrix

| Surface | Owns | Does not own | Status |
| --- | --- | --- | --- |
| Application shell | Chooses concrete implementations, constructs or shares the source, and invokes native shutdown when appropriate | Ignite runtime internals or source transition semantics | `Current decision` |
| Source ecosystem | Native state transitions, policy, persistence, cancellation, replay, transport, and shutdown semantics | Ignite-specific wrappers or lifecycle containers | `Current decision` |
| `igniteCore(...)` | Projection assembly from the exact source plus command/effect/schema callbacks | Source provisioning, environment selection, wrapper composition, or disposal policy | `Current decision` |
| Ignite effects | Outward facts for hosts, tests, and observers | Environmental I/O, retained-resource ownership, or source shutdown | `Current decision` |
| Presentation ref/commit code | Retained-resource acquisition, updates, and cleanup | Domain truth, source lifecycle, or runtime authority | `Current decision` |
| Actor-Web runtime | Admission, authorization, execution evidence, checkpoints, replay, reconciliation, and transport lifecycle | Ignite projection ownership | `Current decision` |

## Canonical Boundary

The accepted boundary is direct exact-source provisioning:

```text
const source = composeSourceWithNativeApis(...);
const projection = igniteCore({
  source,
  states,
  commands,
  effects,
  events,
});
```

The composition step happens before `igniteCore(...)` and remains native to the
selected source ecosystem.

Ignite does not accept:

```text
igniteCore({
  source,
  ports,
  driver,
  environment,
  igniteEnvironment,
  feature,
  onDispose,
});
```

## Source-Native Composition Patterns

The same rule applies across ecosystems: bind dependencies where that ecosystem
already expects them, then pass the exact result to Ignite.

### XState

```text
const machine = setup({
  actions: {
    navigateToDashboard: ({ context }) => context.navigate("/dashboard"),
  },
}).createMachine(...);

igniteCore({ adapter: "xstate", source: machine, ... });
```

### Redux

```text
const store = configureStore({
  reducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      thunk: { extraArgument: ports },
    }),
});

igniteCore({ adapter: "redux", source: store, ... });
```

### MobX

```text
const store = new SessionStore({ storage, clock });

igniteCore({ adapter: "mobx", source: store, ... });
```

### Actor-Web

```text
const source = createActorWebSource({ transport, address, ... });

igniteCore({ adapter: "actor-web", source, ... });
```

### Browser, Node, And Deterministic Fakes

```text
const browserSource = createAppSource({ navigation, storage, fetchJson, clock });
const nodeSource = createAppSource({ readFile, writeFile, fetchJson, clock });
const fakeSource = createAppSource(fakePorts);

igniteCore({ source: browserSource, ... });
igniteCore({ source: nodeSource, ... });
igniteCore({ source: fakeSource, ... });
```

The point is not uniform construction code. The point is uniform ownership:
Ignite consumes the exact source that the application already owns.

## Shared Versus Isolated Sources

Ignite does not decide whether a source is shared or isolated.

| Ownership mode | Owner | Example | Status |
| --- | --- | --- | --- |
| Isolated per mount, request, or test | Application or source factory | New machine/store/observable per consumer | `Current fact` |
| Shared live source | Application shell or source runtime | Shared Redux store, MobX singleton, Actor-Web source | `Current fact` |
| Native shutdown decision | Application or source runtime | `store.dispose()`, `subscription.close()`, `actor.stop()`, `abortController.abort()` | `Current decision` |

Ignite may clean up only its own observation handle. It must not infer that
element disconnect or watcher cleanup means the source itself should stop.

## Commands, Effects, And Host Boundaries

Fixed decisions:

- Commands remain source-directed intent.
- Effects remain outward facts.
- Commands must not mutate host or environment surfaces directly.
- Effects must not perform environmental I/O.
- Current compatibility seams such as physical `host` access do not redefine the
  accepted architecture.
- Projected `canExecute`, accepted `send`, and Story evidence are descriptive,
  not authoritative execution receipts.

## Retained Presentation Boundary

Retained resources stay outside source provisioning and outside effects.

- Canvas, WebGL, Cytoscape, editors, maps, and observers are presentation-owned.
- Ref or commit code may acquire, update, and release them.
- Ignite may project the state they consume.
- Ignite does not own their lifecycle, and their cleanup must not terminate the
  source.

## `igniteShell`

`igniteShell` remains a narrow sourceless composition helper.

- Use it when there is no source.
- Do not treat it as a source-provisioning API.
- Do not treat it as a host-environment container.

## Rejected Alternatives

| Alternative | Rejection |
| --- | --- |
| Add `ports`, `driver`, or environment config to `igniteCore(...)` | Collapses application-owned composition into an Ignite-specific DI surface. |
| Introduce `createFeature(...)` or `Feature` as the accepted provisioning wrapper | Replaces existing native composition seams with an Ignite-owned wrapper. |
| Let `onDispose(...)` or element disconnect own source shutdown | Erases the difference between Ignite observation cleanup and native source lifecycle. |
| Let commands or effects perform host I/O directly | Breaks intent/fact separation and leaks imperative shell work into Ignite callbacks. |
| Put retained-resource lifecycle into effects | Conflates projection with presentation-owned identity and cleanup. |

## Evidence Matrix

The accepted contract is backed by current repository evidence:

| Claim | Evidence | Command or fixture | Ownership |
| --- | --- | --- | --- |
| `igniteCore(...)` consumes the exact source rather than an Ignite wrapper | task `direct-1785375394663`; Redux and MobX dogfood receipts; exact-source docs/task packet alignment | focused example runtime and typecheck lanes for Redux and MobX | Application and source ecosystem own composition |
| Deterministic sources may not import environmental APIs directly when rules forbid them | task `direct-1785381384532`; `scripts/check-architecture-rules.mjs`; `scripts/__tests__/architecture-boundaries.test.mjs` | `pnpm architecture:check` and `pnpm run test:scripts` | Conformance enforcement |
| Public command context does not regain removed host escape hatches | `packages/ignite-element/src/tests/types/igniteCore.types.test.ts` | package typecheck lane | Ignite public contract |
| Headless runtime remains DOM-free while preserving runtime observation semantics | `packages/ignite-element/src/tests/agent-runtime-headless-node.test.ts` | `pnpm --filter ignite-element test:node` | Ignite runtime host |
| Actor-Web remains projection-only from Ignite's side | `docs/actor-web-evidence-governed-projections.md`; actor-web public type tests and adapter coverage | package test and typecheck lanes | Actor-Web runtime owns execution authority |

Freshness note:

- The exact-source dogfood evidence was refreshed on July 30, 2026 through the
  completed task `direct-1785375394663`.
- The deterministic-source import enforcement evidence was refreshed on
  July 30, 2026 through the current task `direct-1785381384532`.

## Cross-References

- [`docs/architecture.md`](./architecture.md): package-family ownership summary
- [`docs/shared-architecture-model.md`](./shared-architecture-model.md):
  ADR-003 alignment and cross-repo evidence posture
- [`docs/v3-api-consistency.md`](./v3-api-consistency.md): vocabulary and
  surface-consistency index
- [`docs/actor-web-evidence-governed-projections.md`](./actor-web-evidence-governed-projections.md):
  Ignite-side Actor-Web projection boundary
