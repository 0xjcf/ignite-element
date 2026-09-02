# ignite-adapters

## 3.0.0-beta.11

### Major Changes

- 4b9effe: Make the v3 package family native ESM-only.

  Remove the CommonJS `main` and `require` contracts and stop publishing CommonJS
  or default UMD build artifacts. Consumers must use ESM imports. Existing public
  ESM entrypoints and their TypeScript declarations remain supported.

- 1b09e98: Narrow the v3 beta command and effect callback contract before stable release.

  Commands no longer expose a public `host` capability. Public command callbacks
  now receive `{ actor, command }`, so host-derived intent must be provided as
  explicit command input instead of being read from the runtime host.

  Effects no longer expose public `actor` or `host` capabilities and now receive
  only `{ snapshot, prevSnapshot, select, emit }`. Effects are synchronous
  transition-to-outward-fact callbacks: async work, retries, cancellation, and
  feedback into the source must move into source-native actors, actions, store
  methods, middleware, or transports.

  Public effect callbacks must return `undefined`/nothing so `async` functions are
  rejected at compile time. Inline callbacks can usually omit a return, while
  extracted or explicitly typed helpers may need an `undefined` return annotation
  plus an explicit `return undefined`.

  The runtime still keeps internal host ownership for DOM/headless event dispatch
  and error routing, and it now fails closed when untyped JavaScript effects
  return a thenable.

### Minor Changes

- a7486a9: Make `states(snapshot)` the canonical optional v3 projection contract. Config
  `view`, `getView`, and `watchView` are removed; headless schemas, execution
  results, stories, tests, and tools now use states vocabulary. XState entrypoints
  expose native `StateFrom<Machine>` snapshots instead of flattened
  `ExtendedState`, and public component renderers receive derived states and
  semantic commands without raw `state` or `send`.

### Patch Changes

- Updated dependencies [a7486a9]
- Updated dependencies [4b9effe]
- Updated dependencies [1b09e98]
  - @ignite-element/core@3.0.0-beta.11

## 3.0.0-beta.10

### Patch Changes

- @ignite-element/core@3.0.0-beta.10

## 3.0.0-beta.9

### Major Changes

- ccdc9e5: Collapse `ActorWebAddress` to plain `string` now that `@actor-web/runtime@0.2.0` publishes the canonical branded string `ActorAddress`.

  The actor-web adapter no longer accepts the legacy object address shape from `@actor-web/runtime@0.1.x`; the optional actor-web peer floor is now `>=0.2.0`.

### Minor Changes

- 787b6c8: Make the headless agent runtime DOM-free, so `getSchema()` / `execute()` / `on()` / `watchView()` work in pure Node and edge runtimes with no jsdom polyfill.

  The agent runtime is meant to be headless, but it allocated its internal host element via `document.createElement`, so `getSchema()` / `execute()` threw `document is not defined` in a non-DOM runtime. That host is only ever used as an **EventTarget** — `on()` registers `host.addEventListener` / `removeEventListener` and effect emits go through `host.dispatchEvent` — so a real element was never required for headless use. `createRuntimeHost` now falls back to a bare `EventTarget` when there is no `document` (Node 22 ships `EventTarget` + `CustomEvent` globally), and keeps `document.createElement` when a real or jsdom DOM is present (no behavior change in the browser or in tests). The DOM render path (the custom element / DOM bridge) is unchanged and still requires a real DOM. This unblocks running an igniteTools agent loop — the act → observe → act surface — headless on a server, CLI, or edge device with zero DOM shim.

- fe3fc74: Add the Anthropic `ToolDialect` adapter — the first provider dialect for igniteTools — on a new `ignite-element/tools/anthropic` entrypoint, and refine the `ToolDialect` port to its final shape.

  - **Added — `ignite-element/tools/anthropic`:** a pure, SDK-free `anthropic` dialect (no `@anthropic-ai/sdk` runtime dependency) that translates the neutral manifest to/from the Anthropic Messages tool-use wire format — `tools()` emits `{ name, description?, input_schema }` defs, `toolCalls()` extracts `tool_use` blocks, and `toolResult()` renders `tool_result` blocks (`is_error: true` on a failed call). The consumer brings the SDK and runs the model loop.
  - **Added — shared scalar round-trip (`tools/scalar.ts`):** `toProviderInputSchema`/`fromProviderInput` object-wrap a single-arg command's scalar input under a `value` key for the model and unwrap the returned `{ value }` on the way back — gated on the manifest schema, so an object command with its own `value` field is never unwrapped (collision-free). The neutral manifest stays scalar-honest; wrapping lives only at the provider boundary. PR3 (OpenAI/Ollama) reuses these verbatim.
  - **Breaking (pre-stable beta igniteTools surface) — `ToolDialect` port + `igniteTools` result renamed to bare ecosystem nouns:** `toToolDefs` → `tools`, `parseToolCalls` → `toolCalls` (now `toolCalls(response, manifest)`, the manifest threaded in for scalar unwrap), `toToolResult` → `toolResult`; the consumer execution verb `invoke` → `run`. The bound first argument/type is now `runtime` / `IgniteToolsRuntime` (was `component` / `IgniteToolsComponent`) — it is the agent runtime, not a UI element. `ToolObservation` is unchanged: `run`/`execute` remain act-plus-acknowledgement observations (state at command-acknowledgement; ongoing/remote effects are observed via the view/event stream).

- eabc37d: igniteTools: surface the derived **view** in `ToolObservation` so an agent grounds on the read-model, not just the raw snapshot.

  `run()`'s observation is now `{ snapshot, view, events }` (was `{ snapshot, events }`). `igniteTools` binds `getView` — added to the `IgniteToolsRuntime` surface alongside `getSchema`/`execute` — and captures it at command-acknowledgement, so every observation, and thus every provider `tool_result` a dialect serializes, carries the view (the derived read-model, e.g. `lightsOn`/`allDoorsLocked`) the design says agents should ground on, distinct from the raw snapshot. `ToolObservation<Snapshot, Events>` gains a `View` type parameter (`ToolObservation<Snapshot, View, Events>`) and `NeutralToolResult` threads it through. Breaking to the pre-stable beta igniteTools surface (the observation shape + the `IgniteToolsRuntime` pick); the Anthropic dialect needs no change (it serializes the whole observation). Found while dogfooding the headless smart-home agent example.

- b0f3aee: Add command availability predicates through `command(fn, { canExecute })` and expose the headless runtime `canExecute(name)` query, with gated commands marked in `getSchema()`.

### Patch Changes

- 02b9381: Remove the positional effects callback form for v3 beta. Effects callbacks now
  use only the object-form signature:
  `({ snapshot, prevSnapshot, actor, emit, host, select }) => { ... }`.
- Updated dependencies [02b9381]
- Updated dependencies [8201902]
- Updated dependencies [787b6c8]
- Updated dependencies [fe3fc74]
- Updated dependencies [eabc37d]
- Updated dependencies [b0f3aee]
  - @ignite-element/core@3.0.0-beta.9

## 3.0.0-beta.8

### Minor Changes

- b263e78: Unify the actor-web adapter config surface and accept actor-web's opaque branded address.

  **Breaking — `commandSource` and `ActorWebSourceHandle` removed.** Every adapter now takes a single `source`, so the config surface is uniform: `{ source, view, commands, effects, events }`. The actor-web read/write `commandSource` config key and the `ActorWebSourceHandle` source-bundle are gone — the command actor derives from the single `source` (writable iff it exposes `send`); a read-only source yields no command actor (command dispatch is a no-op with a dev warning, unchanged). Migrate `igniteCore({ source: readModel, commandSource: cmd, … })` to a single command-capable `source`. actor-web's read/write split, when needed, lives inside the source object — not a second `igniteCore` key.

  **Address contract — `ActorWebAddress` accepts actor-web's opaque branded address.** actor-web's canonical `ActorAddress` collapsed from an object interface to an opaque branded `string`. Ignite's loose `ActorWebAddress` is widened to `string | { id; path; type?; node? }` so the compile-time drift guard against `@actor-web/runtime` stays green for both the published object-address runtime and the new branded-string runtime. The address is opaque to Ignite (pass-through only — never read for `.id`/`.path`/`.node`), so it will later collapse to plain `string` once actor-web publishes the branded address and Ignite bumps the dep.

### Patch Changes

- Updated dependencies [b263e78]
  - @ignite-element/core@3.0.0-beta.8

## 3.0.0-beta.7

### Minor Changes

- 75cd1c2: `XStateCommandActor` now exposes xstate-native `getSnapshot()` and the invented `.state` accessor is removed.

  The command actor handed to `commands`/`effects` (`({ actor }) => …`) is deliberately adapter-native — Redux exposes `{ dispatch, getState }`, MobX is the store, Actor-Web is its command source. The XState command actor was the lone outlier: it exposed an ignite-invented `readonly state` getter instead of xstate v5's native `actor.getSnapshot()` (which is also the runtime's snapshot vocabulary). Reading current state inside a command/effect now uses `actor.getSnapshot().context.…` instead of `actor.state.context.…`, so there is one snapshot vocabulary across the whole surface and no library-specific alias to learn.

  - **Changed (`@ignite-element/adapters`):** `XStateCommandActor<Machine>` is now `{ send; getSnapshot(): ExtendedState<Machine> }` (was `{ send; readonly state }`). Same value, native method name.
  - **Migration:** in XState `commands`/`effects`, replace `actor.state` with `actor.getSnapshot()`. (Redux/MobX/Actor-Web command actors are unchanged.)

  Pre-stable cleanup: lands before `3.0.0`. Completes the source-native vocabulary alignment begun in the adapter-contract snapshot-naming change.

### Patch Changes

- Updated dependencies [75cd1c2]
  - @ignite-element/core@3.0.0-beta.7

## 3.0.0-beta.6

### Patch Changes

- @ignite-element/core@3.0.0-beta.6

## 3.0.0-beta.5

### Major Changes

- 74e4700: Remove the deprecated pre-stable API surface (T7). Everything removed here had warned in dev mode since the canonical names landed in the v3 beta line.

  - **Removed runtime aliases:** `getState()` (use `getSnapshot()`), `watch(handler)` (use `watchSnapshot(handler)`), and `subscribe(eventName, handler)` (use `on(eventName, handler)`), along with their once-per-process dev warnings.
  - **Removed config alias:** the `states` projection option on every adapter config (xstate, redux, mobx, actor-web) and the low-level factories — use `view`. The `FacadeStatesCallback` and `AnyStatesCallback` types are gone with it.
  - **Removed type alias:** `IgniteAgentStateListener` — use `IgniteAgentSnapshotListener`.
  - **Removed:** `IgniteElement.forceRender()`, which had been slated for removal since v2. Rendering is driven by state changes; there is no supported imperative re-render.

  Migration is mechanical: rename `states:` config keys to `view:`, `getState()`/`watch()`/`subscribe()` calls to `getSnapshot()`/`watchSnapshot()`/`on()`, and `IgniteAgentStateListener` to `IgniteAgentSnapshotListener`. The canonical surface is unchanged.

### Minor Changes

- 75abf87: Align the internal `IgniteAdapter` contract with the public `igniteCore` snapshot vocabulary so the adapter-authoring surface reads consistently with the runtime it feeds.

  - **Renamed (core `IgniteAdapter`):** `getState()` → `getSnapshot()`, `subscribe(listener)` → `subscribeSnapshots(listener)`. (The optional emitted-event method is `subscribeEvents()`.) This is the contract custom adapters implement; the built-in XState/Redux/MobX/Actor-Web adapters, the runtime bridge, and the projection factories all move to the new names.
  - **Unchanged — public API:** the headless runtime keeps `getSnapshot()`, `watchSnapshot()`, `on()`, `execute().events`, and `record()`. Application code and command/view/effects authoring are unaffected.
  - **Unchanged — source-native vocabulary:** adapters still speak their source's language internally — Redux `store.getState()`/`store.subscribe()`, XState `actor.getSnapshot()`/`actor.subscribe()`, Actor-Web `source.snapshot()`/`source.subscribeEvent()`. Only the Ignite-facing contract names changed.

  Pre-stable cleanup: this lands before `3.0.0` so the adapter contract ships stable with one consistent vocabulary. Only authors of custom `IgniteAdapter` implementations need to rename the three members.

### Patch Changes

- Updated dependencies [75abf87]
- Updated dependencies [74e4700]
  - @ignite-element/core@3.0.0-beta.5

## 3.0.0-beta.4

### Minor Changes

- 484d3f3: Add `@actor-web/runtime` as an optional peer dependency of `@ignite-element/adapters`, with compile-time drift-proofing against its canonical neutral source types.

  The adapter's public `ActorWeb*` types stay self-contained and deliberately looser than the canonical contract (optional `subscribeEvent`/`transportStatus`/snapshot helpers, so barebones and foreign sources remain accepted), and the optional peer never enters the shipped type graph. A typecheck-only assertion suite now pins the relationship — every real `@actor-web/runtime` source (`ActorReadModelSource`/`ActorCommandSource`) is verified assignable to the adapter's accepted shape, and transport-status/event-subscription shapes are verified field-identical in both directions — so upstream contract drift fails the build instead of surfacing in consumers. No runtime behavior change; consumers without `@actor-web/runtime` are unaffected.

- c7fac99: Canonicalize the headless-runtime raw-read surface on snapshot vocabulary and the projection config on `view`, with a clean deprecation path.

  - **Added:** `getSnapshot()` and `watchSnapshot(handler)` on the headless runtime as the canonical raw-read accessor and subscription, restoring symmetry with `getView()`/`watchView()`. Added the `IgniteAgentSnapshotListener` type.
  - **Deprecated (still functional, dev-mode `console.warn`, removed at stable v3):** `getState()` → use `getSnapshot()`; `watch(handler)` → use `watchSnapshot(handler)`; the existing `subscribe(eventName, handler)` alias now also warns (use `on`); the `states` projection config option and `FacadeStatesCallback` type → use `view`. `IgniteAgentStateListener` is kept as a deprecated alias of `IgniteAgentSnapshotListener`.

  No behavior change: every deprecated alias delegates to its canonical counterpart and continues to work through the v3 beta. The deterministic-effects contract, `getView`, and the headless runtime remain identical across all four adapters.

- 3254246: Add a uniform, optional emitted-event streaming seam so sources with a native event side-channel surface their domain events through the headless runtime automatically.

  - **Added (core):** optional `stream?(listener): { unsubscribe() }` on `IgniteAdapter`, plus a third `Emitted` type parameter (default `never`). Adapters that emit no source events simply omit the method — fully backward-compatible.
  - **Added (runtime):** `createAgentRuntime` bridges the seam — `on(type)` forwards source emits of that type for the subscription's lifetime, and `execute()` captures emits during the command window into `result.events` (independent of the declared `events:` map); `record()` inherits both. Uniform shape: an emitted member `M` surfaces as `{ type: M.type, payload: M }` in `execute().events` and as `event.detail === M` in `on(...)` handlers. Subscriptions are per-consumer and leak-free.
  - **Added (actor-web):** `ActorWebAdapter` implements `stream()` by wrapping the source's optional `subscribeEvent`, and the source's distinct `Emitted` union threads into the runtime `Events` typing — `on()`/`execute().events` are typed from the source with no manual type arguments.

  No behavior change for non-emitting adapters (XState/Redux/MobX) or for effects-declared events, which keep flowing alongside the bridge. `getSchema().events` still lists declared event names only; source-emitted types are dynamic and observable via `on(...)`/`execute().events`.

### Patch Changes

- Updated dependencies [484d3f3]
- Updated dependencies [c7fac99]
- Updated dependencies [3254246]
  - @ignite-element/core@3.0.0-beta.4

## 3.0.0-beta.3

### Patch Changes

- @ignite-element/core@3.0.0-beta.3

## 3.0.0-beta.2

### Minor Changes

- Publish the supporting packages under the `@ignite-element` npm scope: `ignite-core` → `@ignite-element/core`, `ignite-adapters` → `@ignite-element/adapters`, `ignite-renderer` → `@ignite-element/renderer`. The main `ignite-element` package keeps its unscoped name. Import paths move accordingly (e.g. `@ignite-element/adapters/xstate`); `ignite-element` consumers are unaffected since the siblings are internal dependencies resolved at install time.

### Patch Changes

- Updated dependencies
  - @ignite-element/core@3.0.0-beta.2

## 3.0.0-beta.1

### Minor Changes

- Mark the state-library and renderer peers as optional so consumers only install what they actually use. `xstate`, `redux`, `@reduxjs/toolkit`, and `mobx` are pick-one adapters, and `lit-html` is only needed for the opt-in `lit` render strategy — the default renderer is `ignite-jsx`, which pulls no `lit-html` at runtime. Installing `ignite-element` with one adapter (e.g. `npm i ignite-element xstate`) no longer drags in the other state libraries or emits unmet-peer warnings for them.

### Patch Changes

- ignite-core@3.0.0-beta.1

## 3.0.0-beta.0

### Patch Changes

- Updated dependencies [3dd4dd2]
  - ignite-core@3.0.0-beta.0
