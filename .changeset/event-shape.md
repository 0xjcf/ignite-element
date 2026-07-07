---
"ignite-element": minor
"@ignite-element/core": minor
---

Canonicalize events on the flat tagged `{ type, ...fields }` member shape for v3 beta. Effects now emit with `emit({ type, ...fields })`, and the headless runtime, tools, story summaries, and `expectEvent` assertions now observe the same flat member instead of the previous `{ type, payload }` envelope.
