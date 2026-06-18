---
"@ignite-element/core": minor
"@ignite-element/adapters": minor
"@ignite-element/renderer": minor
"ignite-element": minor
---

`XStateCommandActor` now exposes xstate-native `getSnapshot()` and the invented `.state` accessor is removed.

The command actor handed to `commands`/`effects` (`({ actor }) => …`) is deliberately adapter-native — Redux exposes `{ dispatch, getState }`, MobX is the store, Actor-Web is its command source. The XState command actor was the lone outlier: it exposed an ignite-invented `readonly state` getter instead of xstate v5's native `actor.getSnapshot()` (which is also the runtime's snapshot vocabulary). Reading current state inside a command/effect now uses `actor.getSnapshot().context.…` instead of `actor.state.context.…`, so there is one snapshot vocabulary across the whole surface and no library-specific alias to learn.

- **Changed (`@ignite-element/adapters`):** `XStateCommandActor<Machine>` is now `{ send; getSnapshot(): ExtendedState<Machine> }` (was `{ send; readonly state }`). Same value, native method name.
- **Migration:** in XState `commands`/`effects`, replace `actor.state` with `actor.getSnapshot()`. (Redux/MobX/Actor-Web command actors are unchanged.)

Pre-stable cleanup: lands before `3.0.0`. Completes the source-native vocabulary alignment begun in the adapter-contract snapshot-naming change.
