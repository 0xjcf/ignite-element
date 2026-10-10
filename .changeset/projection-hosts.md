---
"ignite-element": minor
"@ignite-element/renderer": minor
---

Mount imperative hosts from a `use` prop when an element connects, and dispose them on the shared unmount path.

`describe` is the accessible text for a projection. The element points at it with `aria-describedby`, and the same text is included in document and speech projections. It is derived from the snapshot alone, so a server render can show it without calling `mount`. A client mount queues the latest slice until it resolves, keeps the instance across a keyed move, and leaves the element in charge of its subtree. `use` takes a handle from that core's `hosts`. The runtime value is the host name. Types reject a missing name, a bare string, and a cast from a string (`as unknown as` forges the handle). A different host map is a different type, so `jsx("canvas", { use })` rejects it. JSX tag syntax does not: the tag drops `use`, so another core's handle typechecks there, including on a core with no hosts. Identical host maps are the same type in both forms. The development build warns when `use` names a host the rendering core did not declare. Same host names are not distinguished, because the value is only the name.
