---
"@ignite-element/core": minor
"@ignite-element/adapters": minor
"@ignite-element/renderer": minor
"ignite-element": minor
---

Add the Anthropic `ToolDialect` adapter — the first provider dialect for igniteTools — on a new `ignite-element/tools/anthropic` entrypoint, and refine the `ToolDialect` port to its final shape.

- **Added — `ignite-element/tools/anthropic`:** a pure, SDK-free `anthropic` dialect (no `@anthropic-ai/sdk` runtime dependency) that translates the neutral manifest to/from the Anthropic Messages tool-use wire format — `tools()` emits `{ name, description?, input_schema }` defs, `toolCalls()` extracts `tool_use` blocks, and `toolResult()` renders `tool_result` blocks (`is_error: true` on a failed call). The consumer brings the SDK and runs the model loop.
- **Added — shared scalar round-trip (`tools/scalar.ts`):** `toProviderInputSchema`/`fromProviderInput` object-wrap a single-arg command's scalar input under a `value` key for the model and unwrap the returned `{ value }` on the way back — gated on the manifest schema, so an object command with its own `value` field is never unwrapped (collision-free). The neutral manifest stays scalar-honest; wrapping lives only at the provider boundary. PR3 (OpenAI/Ollama) reuses these verbatim.
- **Breaking (pre-stable beta igniteTools surface) — `ToolDialect` port + `igniteTools` result renamed to bare ecosystem nouns:** `toToolDefs` → `tools`, `parseToolCalls` → `toolCalls` (now `toolCalls(response, manifest)`, the manifest threaded in for scalar unwrap), `toToolResult` → `toolResult`; the consumer execution verb `invoke` → `run`. The bound first argument/type is now `runtime` / `IgniteToolsRuntime` (was `component` / `IgniteToolsComponent`) — it is the agent runtime, not a UI element. `ToolObservation` is unchanged: `run`/`execute` remain act-plus-acknowledgement observations (state at command-acknowledgement; ongoing/remote effects are observed via the view/event stream).
