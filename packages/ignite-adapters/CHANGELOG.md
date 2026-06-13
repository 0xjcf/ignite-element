# ignite-adapters

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
