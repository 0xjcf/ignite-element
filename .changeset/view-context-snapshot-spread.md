---
"ignite-element": minor
"@ignite-element/core": minor
---

Remove the view-context snapshot spread for the v3 cutover. `view` callbacks now receive a single `{ snapshot }` argument across every adapter, matching the object-form callback shape used by effects and command availability checks. XState and Actor-Web projections should read `snapshot.context` and Actor-Web transport metadata from `snapshot.transport`; Redux and MobX projections read their store state directly from `snapshot`.
