# igniteTools DX (named bind)

Status: **locked product cut, beta break OK**.

- Named-only bind: `igniteTools({ core, schema, canExecute?, dialect? })`.
  Positional `igniteTools(core, dialect, opts)` is removed.
- Explicit schema: `satisfies ToolSchema` or `defineToolSchema`. No schema
  inference from core discovery. No Zod in core.
- `canExecute?: (name: string) => boolean` for all `gated: true` tools. Default
  when omitted is always available. Not authentication.
- Consumer path: `tools` / `toolCalls` / `run` / `toolResult` / `observe`.
  Dialect modules export `textOf`. Apps do not import `buildManifest` /
  `resolveCall`.
- `run` = act + ack. Long/async settle uses `observe` (fan-in of `on` + `watch`).
- Headless proof: Smart Home example and its tests in the Vitest `node`
  environment.
- UI registration uses the callable core: `home('tag', renderer)`. There is no
  `view:` callback on `igniteCore`.
