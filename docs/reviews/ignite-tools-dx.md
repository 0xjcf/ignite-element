# igniteTools DX (named bind)

Status: **locked product cut, beta break OK**.

- Named-only bind: `igniteTools({ core, schema, canExecute?, dialect? })`.
  Positional `igniteTools(core, dialect, opts)` is removed.
- Explicit schema: a bare command map via `satisfies ToolSchema` or
  `defineToolSchema({ toggleLight: { input } })`. No `{ commands: … }` wrapper.
  No schema inference from core discovery. No Zod in core. `ToolInputSchema.type`
  is the closed validator vocabulary (`number` | `string` | `boolean` | `object`
  | `array`); unknown type strings are rejected at construction.
- `canExecute?: (name: string) => boolean` for all `gated: true` tools. Default
  when omitted is always available. Not authentication.
- Consumer path: `tools` / `toolCalls` / `run` / `until` / `toolResult` / `observe`.
  Dialect modules export `textOf`. Apps do not import `buildManifest` /
  `resolveCall`.
- `run` = act + ack. Everyday settle uses `until` (same stream as `observe`).
  `observe` remains for ongoing fan-in.
- Headless proof: Smart Home example and its tests in the Vitest `node`
  environment.
- UI registration uses the callable core: `home('tag', renderer)`. There is no
  `view:` callback on `igniteCore`.
