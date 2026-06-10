# ignite-core

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

## 3.0.0-beta.3

## 3.0.0-beta.2

### Minor Changes

- Publish the supporting packages under the `@ignite-element` npm scope: `ignite-core` → `@ignite-element/core`, `ignite-adapters` → `@ignite-element/adapters`, `ignite-renderer` → `@ignite-element/renderer`. The main `ignite-element` package keeps its unscoped name. Import paths move accordingly (e.g. `@ignite-element/adapters/xstate`); `ignite-element` consumers are unaffected since the siblings are internal dependencies resolved at install time.

## 3.0.0-beta.1

## 3.0.0-beta.0

### Minor Changes

- 3dd4dd2: Promote the view-first single-source DX so object snapshots spread their fields directly onto the view context. `ViewContext<Snapshot>` now resolves to `Snapshot & { snapshot: Snapshot }` for object snapshots, letting view callbacks destructure `context`, `transport`, `phase`, etc. at the top level while `snapshot` stays available for the full read model. Non-object snapshots keep the `{ snapshot }` shape.
