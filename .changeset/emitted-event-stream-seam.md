---
"@ignite-element/core": minor
"@ignite-element/adapters": minor
"@ignite-element/renderer": minor
"ignite-element": minor
---

Add a uniform, optional emitted-event subscription seam so sources with a native event side-channel surface their domain events through the headless runtime automatically.

- **Added (core):** optional `subscribeEvents?(listener): { unsubscribe() }` on `IgniteAdapter`, plus a third `Emitted` type parameter (default `never`). Adapters that emit no source events simply omit the method — fully backward-compatible.
- **Added (runtime):** `createAgentRuntime` bridges the seam — `on(type)` forwards source emits of that type for the subscription's lifetime, and `execute()` captures emits during the command window into `result.events` (independent of the declared `events:` map); `record()` inherits both. Uniform shape: an emitted member `M` surfaces as `{ type: M.type, payload: M }` in `execute().events` and as `event.detail === M` in `on(...)` handlers. Subscriptions are per-consumer and leak-free.
- **Added (actor-web):** `ActorWebAdapter` implements `subscribeEvents()` by wrapping the source's optional `subscribeEvent`, and the source's distinct `Emitted` union threads into the runtime `Events` typing — `on()`/`execute().events` are typed from the source with no manual type arguments.
- **Added (xstate):** `XStateAdapter` implements `subscribeEvents()` over XState v5 emitted events (`emit(...)` / `actor.on('*')`). A machine's declared `emitted` types thread into the runtime `Events` map the same way — `on(type)`/`execute().events`/`record()` are typed from the machine's emitted union with no manual type arguments and no `events:`/`effects:` ceremony. Machines that declare no emitted types contribute nothing (the broad `EventObject` default is filtered, so the events map stays closed).

No behavior change for non-emitting adapters (Redux/MobX omit the seam) or for effects-declared events, which keep flowing alongside the bridge. `getSchema().events` still lists declared event names only; source-emitted types are dynamic and observable via `on(...)`/`execute().events`.
