---
"ignite-element": minor
"@ignite-element/renderer": minor
---

Mount imperative hosts from a `use` prop when an element connects, and dispose them on the shared unmount path.

`describe` is the accessible text for a projection. The element points at it with `aria-describedby`, and the same text is included in document and speech projections. It is derived from the snapshot alone, so a server render can show it without calling `mount`. A client mount queues the latest slice until it resolves, keeps the instance across a keyed move, and leaves the element in charge of its subtree. `use` takes a handle from that core's `hosts`. The runtime value is the host name. A string literal, or a handle from another core, does not typecheck.
