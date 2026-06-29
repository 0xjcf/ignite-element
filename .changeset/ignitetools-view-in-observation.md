---
"@ignite-element/core": minor
"@ignite-element/adapters": minor
"@ignite-element/renderer": minor
"ignite-element": minor
---

igniteTools: surface the derived **view** in `ToolObservation` so an agent grounds on the read-model, not just the raw snapshot.

`run()`'s observation is now `{ snapshot, view, events }` (was `{ snapshot, events }`). `igniteTools` binds `getView` — added to the `IgniteToolsRuntime` surface alongside `getSchema`/`execute` — and captures it at command-acknowledgement, so every observation, and thus every provider `tool_result` a dialect serializes, carries the view (the derived read-model, e.g. `lightsOn`/`allDoorsLocked`) the design says agents should ground on, distinct from the raw snapshot. `ToolObservation<Snapshot, Events>` gains a `View` type parameter (`ToolObservation<Snapshot, View, Events>`) and `NeutralToolResult` threads it through. Breaking to the pre-stable beta igniteTools surface (the observation shape + the `IgniteToolsRuntime` pick); the Anthropic dialect needs no change (it serializes the whole observation). Found while dogfooding the headless smart-home agent example.
