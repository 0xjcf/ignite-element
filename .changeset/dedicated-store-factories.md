---
"ignite-element": patch
---

Allow MobX and Redux factory sources to omit `adapter` when using their dedicated
entrypoints. Preserve inferred states and commands, explicit matching adapters,
and existing source acquisition and cleanup. The public root remains source-free.
