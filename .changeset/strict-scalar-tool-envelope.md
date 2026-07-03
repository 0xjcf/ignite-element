---
"ignite-element": patch
---

Tighten igniteTools scalar provider envelopes by publishing `additionalProperties: false` on scalar wrappers and rejecting malformed `{ value, ...extra }` provider inputs as `InvalidInput`.
