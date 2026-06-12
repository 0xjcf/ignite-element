---
"@ignite-element/core": major
"@ignite-element/adapters": major
"@ignite-element/renderer": major
"ignite-element": major
---

Remove the deprecated pre-stable API surface (T7). Everything removed here had warned in dev mode since the canonical names landed in the v3 beta line.

- **Removed runtime aliases:** `getState()` (use `getSnapshot()`), `watch(handler)` (use `watchSnapshot(handler)`), and `subscribe(eventName, handler)` (use `on(eventName, handler)`), along with their once-per-process dev warnings.
- **Removed config alias:** the `states` projection option on every adapter config (xstate, redux, mobx, actor-web) and the low-level factories — use `view`. The `FacadeStatesCallback` and `AnyStatesCallback` types are gone with it.
- **Removed type alias:** `IgniteAgentStateListener` — use `IgniteAgentSnapshotListener`.
- **Removed:** `IgniteElement.forceRender()`, which had been slated for removal since v2. Rendering is driven by state changes; there is no supported imperative re-render.

Migration is mechanical: rename `states:` config keys to `view:`, `getState()`/`watch()`/`subscribe()` calls to `getSnapshot()`/`watchSnapshot()`/`on()`, and `IgniteAgentStateListener` to `IgniteAgentSnapshotListener`. The canonical surface is unchanged.
