---
"ignite-element": minor
---

Type the test DSL's `expectView` from the runtime's view projection. `igniteTest(component).expectView(...)` now sees the projected view's keys with their value types — mirroring `getView()` — instead of falling back to `Record<string, unknown>`. The runtime `IgniteCoreReturn` already surfaced the projection into `getView()`/`watchView()`/`record()`; the test DSL's `RuntimeView` extractor was reading the wrong runtime generic (schema state) and now reads the view projection. Pre-stable type tightening (loose → typed); no runtime behavior change.
