---
"@ignite-element/core": major
"@ignite-element/adapters": major
"ignite-element": major
---

Narrow the v3 beta command and effect callback contract before stable release.

Commands no longer expose a public `host` capability. Public command callbacks
now receive `{ actor, command }`, so host-derived intent must be provided as
explicit command input instead of being read from the runtime host.

Effects no longer expose public `actor` or `host` capabilities and now receive
only `{ snapshot, prevSnapshot, select, emit }`. Effects are synchronous
transition-to-outward-fact callbacks: async work, retries, cancellation, and
feedback into the source must move into source-native actors, actions, store
methods, middleware, or transports.

Public effect callbacks must return `undefined`/nothing so `async` functions are
rejected at compile time. Inline callbacks can usually omit a return, while
extracted or explicitly typed helpers may need an `undefined` return annotation
plus an explicit `return undefined`.

The runtime still keeps internal host ownership for DOM/headless event dispatch
and error routing, and it now fails closed when untyped JavaScript effects
return a thenable.
