---
"ignite-element": minor
"@ignite-element/renderer": patch
---

Remove the v3 beta projection-target factories and `core(target)` overload from
all public entrypoints. DOM registration, headless reads/observation/commands,
React bindings, tools, canvas refs and host lifecycles retain their contracts.

Migrate application document consumers to `watch` with application-owned
validation/delivery policy; retain source-owned ports for speech acknowledgement,
cancellation and replay. Voice-workbench demonstrates this migration without new
published APIs or private package imports.

Preserve built host installation explicitly in source side-effect metadata, so
removing target inspection cannot prune hosts/use or accessible descriptions.
