---
"ignite-element": major
---

Finalize the pre-stable testing DSL cutover around object-form `igniteTest({ component, host? })` and Story-first composition.

- Remove the positional `igniteTest(component, options?)` form in favor of the single object input.
- Remove `.narrative(...)` and replace it with `.story(...)` as the only managed multi-step testing surface.
- Make Story assertions adapter-neutral by keeping `snapshot` structural-only and moving arbitrary native snapshot predicates to `when(snapshot)`.
- Add `story.behavior(name, operation)` so fixture-owned external collaborators record named before/after Story evidence on the existing trace without incrementing `commandCount`.

Migration is mechanical for beta consumers: wrap the runtime in `{ component }`, rename `.narrative(...)` to `.story(...)`, move any predicate previously stored under `snapshot` to `when`, and wrap external actor/clock/network receipts in `await story.behavior(...)`.
