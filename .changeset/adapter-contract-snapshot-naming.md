---
"@ignite-element/core": minor
"@ignite-element/adapters": minor
"@ignite-element/renderer": minor
"ignite-element": minor
---

Align the internal `IgniteAdapter` contract with the public `igniteCore` snapshot vocabulary so the adapter-authoring surface reads consistently with the runtime it feeds.

- **Renamed (core `IgniteAdapter`):** `getState()` → `getSnapshot()`, `subscribe(listener)` → `subscribeSnapshots(listener)`. (The optional emitted-event method is `subscribeEvents()`.) This is the contract custom adapters implement; the built-in XState/Redux/MobX/Actor-Web adapters, the runtime bridge, and the projection factories all move to the new names.
- **Unchanged — public API:** the headless runtime keeps `getSnapshot()`, `watchSnapshot()`, `on()`, `execute().events`, and `record()`. Application code and command/view/effects authoring are unaffected.
- **Unchanged — source-native vocabulary:** adapters still speak their source's language internally — Redux `store.getState()`/`store.subscribe()`, XState `actor.getSnapshot()`/`actor.subscribe()`, Actor-Web `source.snapshot()`/`source.subscribeEvent()`. Only the Ignite-facing contract names changed.

Pre-stable cleanup: this lands before `3.0.0` so the adapter contract ships stable with one consistent vocabulary. Only authors of custom `IgniteAdapter` implementations need to rename the three members.
