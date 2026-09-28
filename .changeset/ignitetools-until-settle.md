---
"ignite-element": minor
---

Add `until(match)` on the `igniteTools` bind next to `run` and `observe`. Everyday settle waits on the same observation stream as `observe` and unsubscribes on the first defined match (`undefined` / `false` / nullish keep waiting). `observe` remains for ongoing fan-in. Docs teach `run` + `until` instead of Promise + observe + unsubscribe boilerplate.
