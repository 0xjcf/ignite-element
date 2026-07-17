---
"ignite-element": minor
---

Add `igniteTest(...).narrative(name, async (narrative) => ...)` as a typed multi-step test helper over the existing Story recorder.

Narratives keep the current `{ command, input? }` command-call shape, allow assertion-only `given(...)` preconditions, run multiple ordered `intent(...)` steps, expose named expectation-driven checkpoints over the current snapshot/view plus `canExecute(...)` and the last intent's events, and return the existing `IgniteStorySnapshot` receipt shape.
