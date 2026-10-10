# igniteTools DX (named bind)

Status: **locked product cut, beta break OK**.

- Named-only bind: `igniteTools({ core, schema, canExecute?, dialect? })`.
  Positional `igniteTools(core, dialect, opts)` is removed.
- Explicit schema: a bare command map via `satisfies ToolSchema` or
  `defineToolSchema({ toggleLight: { input } })`. No `{ commands: … }` wrapper.
  No schema inference from core discovery. No Zod in core. `ToolInputSchema.type`
  is the closed validator vocabulary (`number` | `string` | `boolean` | `object`
  | `array`); unknown type strings are rejected at construction.
- `canExecute?: (name, input?, context?) => boolean`. Behavior change: this
  amends the earlier rule that the predicate applied only to `gated: true`
  tools and that omission meant always available. Jose chose fail-closed.
  Non-read commands are omitted unless `canExecute` returns true. Omitting
  the predicate denies those commands. An ungated `read: true` tool stays
  available only when that command is side-effect-free; `run` still calls
  `core.execute`. `context.execute` is true only immediately before
  `execute`. `resolveCall` does not set it, so a validation call must not
  consume an application approval. Not authentication. Ignite does not store
  or consume approvals.
- Consumer path: `tools` / `toolCalls` / `run` / `until` / `toolResult` / `observe`.
  Dialect modules export `textOf`. Apps do not import `buildManifest` /
  `resolveCall`.
- `run` = act + ack. Everyday settle uses `until` (same stream as `observe`).
  `observe` remains for ongoing fan-in.
- Headless proof: Smart Home example and its tests in the Vitest `node`
  environment.
- UI registration uses the callable core: `home('tag', renderer)`. There is no
  `view:` callback on `igniteCore`.
