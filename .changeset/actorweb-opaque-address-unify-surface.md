---
"@ignite-element/core": minor
"@ignite-element/adapters": minor
"@ignite-element/renderer": minor
"ignite-element": minor
---

Unify the actor-web adapter config surface and accept actor-web's opaque branded address.

**Breaking — `commandSource` and `ActorWebSourceHandle` removed.** Every adapter now takes a single `source`, so the config surface is uniform: `{ source, view, commands, effects, events }`. The actor-web read/write `commandSource` config key and the `ActorWebSourceHandle` source-bundle are gone — the command actor derives from the single `source` (writable iff it exposes `send`); a read-only source yields no command actor (command dispatch is a no-op with a dev warning, unchanged). Migrate `igniteCore({ source: readModel, commandSource: cmd, … })` to a single command-capable `source`. actor-web's read/write split, when needed, lives inside the source object — not a second `igniteCore` key.

**Address contract — `ActorWebAddress` accepts actor-web's opaque branded address.** actor-web's canonical `ActorAddress` collapsed from an object interface to an opaque branded `string`. Ignite's loose `ActorWebAddress` is widened to `string | { id; path; type?; node? }` so the compile-time drift guard against `@actor-web/runtime` stays green for both the published object-address runtime and the new branded-string runtime. The address is opaque to Ignite (pass-through only — never read for `.id`/`.path`/`.node`), so it will later collapse to plain `string` once actor-web publishes the branded address and Ignite bumps the dep.
