---
"ignite-element": patch
---

Honor source ownership for shared cores. A consumer-owned source (an
already-live instance passed to `igniteCore` → shared scope) now lives for the
core's lifetime instead of being torn down when the element refcount transiently
hits zero — e.g. an outlet swapping pages, which previously froze every page's
reads with a stale snapshot.

- `cleanup` now defaults to `false` for shared scope (consumer-owned sources);
  isolated scope, where ignite owns one adapter per element, keeps per-element
  teardown. Pass `cleanup: true` to opt a shared core back into element-refcount
  teardown.
- Adapters generalize `ownsActor` → `ownsSource`: `stop()` only tears down the
  underlying source when ignite created it. Fixes `ActorWebAdapter` closing a
  consumer-owned source it did not create; XState behavior is unchanged.

Ownership is inferred from what you pass to `source` (a live instance vs a
factory) — no new public option. Fixes the shared-router/SPA footgun.
