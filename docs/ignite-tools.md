# Design: `igniteTools(component)` — hexagonal getSchema → LLM tool-use bridge

## Status

Proposed (design ✓). **Additive**, non-breaking — `3.x` minor. The agent analog of
`ignite-element/react`. Agent-runtime thread in `docs/v3-stable-roadmap.md`.

## Context

`getSchema()` already describes a component as a machine-readable contract — `commands`
(name + input schema + `gated`), `events`, `snapshot`, `view`. With headless
`execute(name, payload)`, that's everything an LLM agent needs to *drive* a component.
`igniteTools` is the bridge from that contract to LLM tool-use.

The key design decision: **this is ignite's own "no lock-in" philosophy applied one
layer up.** Just as ignite adapts xstate/redux/mobx/actor-web behind one core,
`igniteTools` adapts **Anthropic / OpenAI(Codex) / Ollama** behind one **port**. Baking
in a single provider SDK would betray the principle the library is built on. And a local
provider (**Ollama**, via its OpenAI-compatible endpoint) is what unlocks the headless /
embedded / edge showcase — an on-device model driving a component with no cloud and no
web UI.

## Decision — ports & adapters (hexagonal)

```
   driving actors                 igniteTools                          driven actor
   (LLM providers)         ┌──────────────────────────────┐
        │                  │   FUNCTIONAL CORE (pure)      │
  [Anthropic] ─┐  adapter  │   buildManifest(schema)       │        ignite component
  [OpenAI/Codex]┼─(format  │     → NeutralManifest         │ ──────►  execute(name, payload)
  [Ollama]  ─┘   xlate)    │   resolveCall(name,input)     │          getView()/events ◄──
        ▲                  │     → Result<Route, ToolError>│              (actor)
        │                  │                               │               │
   ToolDialect PORT ◄──────┤   ── PORT: ToolDialect ──     │          ┌─ remote actors
   toToolDefs(manifest)    │   parseToolCalls(resp)        │          │  (location-transparent
   toToolResult(result)    │   toToolResult(neutralResult) │          └─  via actor-web)
                           │   IMPERATIVE SHELL            │
                           │   invoke() → execute() I/O    │
                           └──────────────────────────────┘
```

### Functional core (pure, deterministic — no I/O, no SDK)

- `buildManifest(schema): NeutralManifest` — `getSchema().commands` → neutral tools
  `{ name, description, inputSchema, gated }[]`. Availability-gated commands
  (`gated && !canExecute`) are omitted (see `docs/can-execute.md`).
- `resolveCall(name, input): Result<Route, ToolError>` — validate (input against the
  command's `inputSchema`; availability against `canExecute`) and route to
  `{ command, payload }`. Pure; returns a `Result` (errors as values), never throws.

### Port — `ToolDialect`

The provider boundary. A pure format translator between the neutral manifest and a
provider's tool-calling wire format:

```ts
interface ToolDialect<Tools, Response, ResultBlock> {
  toToolDefs(manifest: NeutralManifest): Tools;          // neutral → provider tool defs
  parseToolCalls(response: Response): NeutralToolCall[]; // provider response → neutral calls
  toToolResult(result: NeutralToolResult): ResultBlock;  // neutral result → provider tool_result
}
```

### Adapters (implement the port — separate entrypoints, SDK-free translators)

- **`ignite-element/tools/anthropic`** — Anthropic Messages tool format
  (`tools: [{ name, description, input_schema }]`, `tool_use` blocks, `tool_result`).
- **`ignite-element/tools/openai`** — OpenAI Chat Completions tool format
  (`tools: [{ type: "function", function: { name, description, parameters } }]`,
  `tool_calls`, `role: "tool"` results). **Covers OpenAI, Codex, and Ollama** (Ollama's
  OpenAI-compatible endpoint). A dedicated **`ollama` native adapter** is an optional
  future 4th, only if Ollama's native `/api/chat` tool quirks justify it.
- Adapters are **pure format translators** — they emit/parse the documented JSON shapes
  and have **no provider-SDK runtime dependency** (optional SDK *types* for ergonomics
  only). The **consumer** brings the SDK to make the actual API call. This keeps adapters
  zero-dependency and trivially unit-testable, and keeps bundles clean (you only import
  the adapter you use), mirroring `ignite-element/react`'s optional-peer discipline.

### Imperative shell

- `invoke(toolCall): Promise<Result<{ snapshot, events }, ToolError>>` — the single
  side-effect: `component.execute(name, payload)` (which may reach a remote actor). Returns
  a `Result` so a failed command is data the agent reacts to, not an exception across the
  seam. The LLM API call itself stays in the **consumer's** loop — `igniteTools` provides
  the (provider-shaped) `tools` + `invoke`; the consumer runs the model.

### API shape (proposal, refine in PR 1)

```ts
import { igniteTools } from "ignite-element/tools";
import { anthropic } from "ignite-element/tools/anthropic";

const { tools, invoke } = igniteTools(release, anthropic); // Anthropic-shaped, gated tools
// neutral core is usable directly too:
const { manifest, resolveCall, invoke } = igniteTools(release); // no dialect → neutral
```

## How the design embodies the principles

| Principle | Where it lives |
| --- | --- |
| **Hexagonal (ports/adapters)** | `ToolDialect` port; `anthropic`/`openai` adapters; core never imports a provider |
| **Functional core / imperative shell** | core = `buildManifest`/`resolveCall` (pure); shell = `invoke` (`execute` I/O) |
| **DDD boundaries** | domain = manifest/routing; adapters translate + **return facts (no throw)**; shell coordinates |
| **Errors as values** | `resolveCall`/`invoke` → `Result<…, ToolError>`; the LLM gets the error back as a `tool_result` |
| **Actor model + topology** | agent-actor → `[igniteTools seam]` → component-actor → remote actors; a tool-call *is* a message; location-transparent via actor-web |
| **Projections** | the agent grounds on the **view** (`getView()` / `getSchema().view`), the derived read-model — distinct from the raw snapshot |
| **TDD** | pure core + each dialect = unit-tested with **zero LLM calls** (golden neutral↔provider fixtures); red→green per piece |
| **Manual validation** | headless loop per provider; **Ollama gives a fully-local, key-free loop** (the edge showcase) |

## `ToolError` (errors as values)

A tagged union returned (never thrown) by `resolveCall`/`invoke`:
`UnknownCommand` · `InvalidInput` (fails the command's `inputSchema`) · `Unavailable`
(`canExecute` false) · `ExecuteFailed` (the command rejected). The consumer maps an `err`
to the provider's `tool_result` (`is_error: true`) so the model can recover.

## Sequencing — three PRs (each: branch off `beta` → TDD/DDD + manual validation → `coderabbit review` → PR `--base beta` → CI + CodeRabbit → approve+merge on green → `fas done`; changeset per PR)

1. **PR 1 — core + `ToolDialect` port + a fake dialect.** TDD. No provider SDK. Proves
   the neutral core (`buildManifest`/`resolveCall`/`invoke` with `Result`) end-to-end
   against a fake component + fake dialect. Establishes the `ignite-element/tools`
   entrypoint + the `ToolDialect` interface.
2. **PR 2 — `anthropic` adapter** (`ignite-element/tools/anthropic`). Golden
   neutral↔Anthropic fixtures (TDD). Manual validation: a headless Anthropic loop.
3. **PR 3 — `openai` adapter** (`ignite-element/tools/openai`; covers Codex + Ollama via
   OpenAI-compat). Golden fixtures (TDD). Manual validation: headless OpenAI **and** a
   local Ollama (OpenAI-compat) loop — proves the port generalizes cloud→local.

## Dependencies

- **typed-view** ✓ + **`getSchema().view`** ✓ (done) — typed manifest inputs + view grounding.
- **`canExecute`** (`docs/can-execute.md`) — composes for availability-gated tools (omit
  unavailable commands from the manifest). Optional; without it all commands are offered.

## Alternatives considered

- **Bake in the Anthropic SDK** — rejected: lock-in; betrays ignite's no-lock-in philosophy.
- **"Neutral core + one Anthropic helper" (no port)** — rejected: doesn't generalize to
  Ollama/OpenAI; the port *is* the point.
- **Adapters that wrap the provider SDK at runtime** — rejected: adapters are pure format
  translators; the consumer brings the SDK; keeps adapters zero-dep + pure-testable.

## Related

- `docs/can-execute.md`, `docs/ignite-react.md` (the sibling schema-driven wrapper).
- `docs/v3-api-consistency.md`, `docs/v3-stable-roadmap.md`.
- Memory: `v3-api-consistency-epic`.
