---
"@ignite-element/adapters": minor
"ignite-element": minor
---

Collapse `ActorWebAddress` to plain `string` now that `@actor-web/runtime@0.2.0` publishes the canonical branded string `ActorAddress`.

The actor-web adapter no longer accepts the legacy object address shape from `@actor-web/runtime@0.1.x`; the optional actor-web peer floor is now `>=0.2.0`.
