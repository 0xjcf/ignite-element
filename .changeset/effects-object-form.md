---
"@ignite-element/core": patch
"@ignite-element/adapters": patch
"ignite-element": patch
---

Remove the positional effects callback form for v3 beta. Effects callbacks now
use only the object-form signature:
`({ snapshot, prevSnapshot, actor, emit, host, select }) => { ... }`.
