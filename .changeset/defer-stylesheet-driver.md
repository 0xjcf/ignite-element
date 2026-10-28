---
"ignite-element": patch
"@ignite-element/renderer": patch
---

Separate element reconnection signals from global stylesheet delivery so
headless consumers can omit the stylesheet driver. Activate delivery when
styles are selected or the injector is used, retaining explicit flush,
reconnect, cancellation, and stylesheet validation behavior. Pending element
roots use weak references where available. Public entrypoints and APIs remain
unchanged.
