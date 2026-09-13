---
"ignite-element": major
"@ignite-element/renderer": patch
"@ignite-element/adapters": patch
---

Import and use source-backed cores in Node without fabricated browser globals.
DOM registration now requires a browser and reports a synchronous registration
error when unavailable. Renderer defaults are selected at registration rather
than construction; explicit strategies bypass default selection.

Preserve source-free registration and source-owned lifetimes while making
observation handles idempotent and rolling back partial Actor-Web observations.
The combined release adds explicit final core disposal and neutral declaration
boundaries for headless and no-DOM consumers. Core cleanup releases Ignite-owned
observations; it does not shut down caller-owned sources. React and React Native
bindings borrow prepared cores, while applications retain preparation and final
disposal ownership.
