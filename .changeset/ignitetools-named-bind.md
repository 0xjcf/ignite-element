---
"ignite-element": minor
---

BREAKING (beta): `igniteTools` is named-only — `igniteTools({ core, schema, canExecute?, dialect? })`. The positional `igniteTools(core, dialect, opts)` overload is removed. `ToolSchema` is a bare command map (`{ toggleLight: { input, description?, gated? } }`), not `{ commands: { toggleLight: … } }`. Author with `satisfies ToolSchema` or `defineToolSchema`; discovery does not infer them. `canExecute` remains one `(name: string) => boolean` predicate for gated tools and defaults to always-available when omitted. Provider dialects export `textOf` so loops do not copy-paste response parsing. `run` stays act-plus-acknowledgement; async settle uses `observe`. `buildManifest` / `resolveCall` remain exported for advanced/testing only. Smart Home and everyday docs teach the consumer path.
