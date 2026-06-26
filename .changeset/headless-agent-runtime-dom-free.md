---
"@ignite-element/core": minor
"@ignite-element/adapters": minor
"@ignite-element/renderer": minor
"ignite-element": minor
---

Make the headless agent runtime DOM-free, so `getSchema()` / `execute()` / `on()` / `watchView()` work in pure Node and edge runtimes with no jsdom polyfill.

The agent runtime is meant to be headless, but it allocated its internal host element via `document.createElement`, so `getSchema()` / `execute()` threw `document is not defined` in a non-DOM runtime. That host is only ever used as an **EventTarget** — `on()` registers `host.addEventListener` / `removeEventListener` and effect emits go through `host.dispatchEvent` — so a real element was never required for headless use. `createRuntimeHost` now falls back to a bare `EventTarget` when there is no `document` (Node 22 ships `EventTarget` + `CustomEvent` globally), and keeps `document.createElement` when a real or jsdom DOM is present (no behavior change in the browser or in tests). The DOM render path (the custom element / DOM bridge) is unchanged and still requires a real DOM. This unblocks running an igniteTools agent loop — the act → observe → act surface — headless on a server, CLI, or edge device with zero DOM shim.
