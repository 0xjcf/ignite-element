---
"ignite-element": minor
---

Add the `ignite-element/react` entrypoint (`igniteReact`) and make registration return a typed `IgniteComponent` handle.

Ignite elements were always consumable from React through the custom-element surface, but imperatively — a hand-written element interface, JSX declaration, event wiring, and ref plumbing kept in sync by hand. `igniteReact` reuses the `getSchema()` metadata ignite already emits for agents to generate an idiomatic, typed React component from a single handle, with no manual type arguments.

- **New (`ignite-element/react`):** `igniteReact(component)` returns a typed `forwardRef` React component. Commands → the imperative ref API (`CommandHandle<Commands>`); single-arg `setX` commands → optional string props (set as attributes, mirroring `inferObservedAttributes`); the events map → `on<Event>` callback props receiving the **flat** event member (`event.detail` is forwarded directly — never the `{ type, payload }` envelope). `react` is an optional peer dependency of this entrypoint only.
- **Changed (`ignite-element`):** registration (`igniteCore(config)(tag, render)`) now returns a typed `IgniteComponent<Commands, Events>` handle (was `void`) carrying `tagName` and a `getSchema()` that delegates to the same single agent-runtime source of truth. Additive — callers that ignore the return are unaffected — and useful beyond React (a typed per-element handle also sharpens the test DSL and agent ergonomics).
- **Generalizes:** the same handle + `getSchema()` drives Vue/Svelte/Angular wrappers as follow-up entrypoints.

Pre-stable: lands in Phase 1 before the breaking cutover so the React demo (`src/examples/frameworks/react`) showcases it.
