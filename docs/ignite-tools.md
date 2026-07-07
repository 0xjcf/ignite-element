# Design: `igniteTools(runtime)` — hexagonal getSchema → LLM tool-use bridge

## Status

Implementing. **PR1 shipped** the SDK-neutral core + `ToolDialect` port + the
`ignite-element/tools` entrypoint (beta.8). **PR2 shipped** the first provider
dialect (`ignite-element/tools/anthropic`) and refined the port to its final
bare-noun shape. **PR3 adds** the OpenAI-compatible
`ignite-element/tools/openai` dialect, which covers OpenAI, Ollama, and local
MLX servers exposed through `/v1/chat/completions`. Together, these are the
agent-runtime counterpart to `ignite-element/react`; the roadmap thread lives in
`docs/v3-stable-roadmap.md`.

## Context

`getSchema()` already describes a component as a machine-readable contract — `commands`
(name + input schema + `gated`), `events`, `snapshot`, `view`. With headless
`execute(name, payload)`, that's everything an LLM agent needs to *drive* a component.
`igniteTools` is the bridge from that contract to LLM tool-use.

The key design decision: **this is ignite's own "no lock-in" philosophy applied one
layer up.** Just as ignite adapts xstate/redux/mobx/actor-web behind one core,
`igniteTools` adapts **Anthropic / OpenAI(Codex) / Ollama / local MLX-compatible
servers** behind one **port**. Baking
in a single provider SDK would betray the principle the library is built on. And a local
provider (**Ollama** or **MLX**, via an OpenAI-compatible endpoint) is what unlocks
the headless / embedded / edge showcase — an on-device model driving a component
with no cloud and no web UI.

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
   tools(manifest)         │   toolCalls(resp, manifest)   │          │  (location-transparent
   toolResult(result)      │   toolResult(neutralResult)   │          └─  via actor-web)
                           │   IMPERATIVE SHELL            │
                           │   run() → execute() I/O       │
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
  // neutral manifest → provider tool defs
  tools(manifest: NeutralManifest): Tools;
  // provider response → neutral calls (manifest enables scalar unwrap)
  toolCalls(response: Response, manifest: NeutralManifest): NeutralToolCall[];
  // neutral result → provider tool_result block
  toolResult(result: NeutralToolResult): ResultBlock;
}
```

Method names are **bare ecosystem nouns** (`tools` / `toolCalls` / `toolResult`) —
the typed direction makes encode/decode verbs redundant, and these are the lingua
franca across Anthropic, OpenAI, the Vercel AI SDK, and LangChain (zero new
vocabulary). `toolCalls` also receives the `manifest` so it can undo the scalar
object-wrap — see **Scalar round-trip** below.

### Scalar round-trip (Option D)

Every tool-calling provider requires **object-shaped** tool inputs and returns
object args, but the neutral manifest is **scalar-honest**: a single-arg command
(`setLimit(n: number)`) carries a scalar `inputSchema` (`{ type: "number" }`),
because that is the command's true contract (`getSchema()` must not lie). So the
wrap/unwrap lives only at the provider boundary, in shared pure helpers
(`tools/scalar.ts`):

- `toProviderInputSchema(schema)` — wraps a scalar under a clean, strict `value`
  key (`{ type: "object", properties: { value: schema }, required: ["value"],
  additionalProperties: false }`); object/no-arg schemas pass through unchanged.
  Adapters call it in `tools()`.
- `fromProviderInput(input, schema)` — unwraps the model's exact `{ value: x }`
  back to `x`, **gated on the manifest schema being scalar** (collision-free: an
  object command that legitimately has its own `value` field is never unwrapped).
  Extra keys keep the provider object intact so `resolveCall` reports
  `InvalidInput`. Adapters call it in `toolCalls()`, which is why the port hands
  `toolCalls` the manifest.

The constraint is universal across providers, so it is fixed once in the port +
two helpers; the OpenAI/Ollama dialect reuses them verbatim.

### Adapters (implement the port — separate entrypoints, SDK-free translators)

- **`ignite-element/tools/anthropic`** — Anthropic Messages tool format
  (`tools: [{ name, description, input_schema }]`, `tool_use` blocks, `tool_result`).
- **`ignite-element/tools/openai`** — OpenAI Chat Completions tool format
  (`tools: [{ type: "function", function: { name, description, parameters } }]`,
  `tool_calls`, `role: "tool"` results). **Covers OpenAI, Codex, Ollama, and MLX**
  when those runtimes expose an OpenAI-compatible endpoint. Dedicated native adapters
  are optional future work only if a provider's native endpoint has useful tool quirks
  that the OpenAI-compatible shape cannot express.
- Adapters are **pure format translators** — they emit/parse the documented JSON shapes
  and have **no provider-SDK runtime dependency** (optional SDK *types* for ergonomics
  only). The **consumer** brings the SDK to make the actual API call. This keeps adapters
  zero-dependency and trivially unit-testable, and keeps bundles clean (you only import
  the adapter you use), mirroring `ignite-element/react`'s optional-peer discipline.

### Imperative shell

- `run(toolCall): Promise<Result<{ snapshot, view, events }, ToolError>>` — the single
  side-effect: `runtime.execute(name, payload)` (which may reach a remote actor). The
  observation carries the raw `snapshot`, the derived **`view`** (the read-model the
  agent grounds on — `igniteTools` binds `getView` and captures it post-command), and
  the `events` from the command window. Returns a `Result` so a failed command is data
  the agent reacts to, not an exception across the seam. The LLM API call itself stays
  in the **consumer's** loop — `igniteTools` provides the (provider-shaped) `tools` +
  `run`; the consumer runs the model.

### Observation contract — act + acknowledgement

`run` (and the underlying `execute`) is **act + ACK observation**: the returned
`ToolObservation` (`{ snapshot, view, events }`) is the snapshot + derived view
**at command-acknowledgement** plus the events emitted up to that point — not
"after the effect settles". The actor model has no
bounded "done" for a long-running effect (a deploy spans minutes and many states),
and a settle-wait would misattribute unrelated concurrent read-model updates. So
for async/remote adapters the observation reflects **state at acknowledgement**.
Ongoing effects are observed via `observe()`, which streams schema-declared
events and derived view transitions from the same `igniteTools` surface: the
agent loop is act → observe → act. A bounded `settle` opt-in on `execute()` is
deferred (YAGNI until the dogfood shows short-command latency hurts).
`ToolObservation` carries `{ snapshot, view, events }` — the derived view is
captured at acknowledgement so the agent grounds on the read-model, not just raw
state.

### API shape

```ts
import { igniteTools } from "ignite-element/tools";
import { anthropic } from "ignite-element/tools/anthropic";

const { tools, toolCalls, run, observe, toolResult } = igniteTools(
  runtime,
  anthropic,
);

const subscription = observe((observation) => {
  if (observation.type === "view") {
    console.log("view changed", observation.view);
  } else {
    console.log("event", observation.event);
  }
});

// the consumer brings the SDK and runs the model loop:
const res = await client.messages.create({ model, messages, tools });
for (const call of toolCalls(res)) {
  const result = await run(call); // act + ACK observation
  blocks.push(toolResult({ id: call.id, name: call.name, result }));
}

// the neutral core is usable directly too:
const {
  manifest,
  resolveCall,
  run: runNeutral,
  observe: observeNeutral,
} = igniteTools(runtime); // no dialect → neutral
```

`toolCalls(res)` stays single-arg for the consumer — `igniteTools` closes over the
manifest internally and hands it to the dialect, so scalar unwrapping is invisible
here.

For OpenAI-compatible model loops, pass `openai` instead of `anthropic`; the
consumer still brings the SDK or `fetch` client:

```ts
import { openai } from "ignite-element/tools/openai";

const { tools, toolCalls, run, toolResult } = igniteTools(runtime, openai);

for (let turn = 0; turn < 8; turn++) {
  const response = await client.chat.completions.create({
    model,
    messages,
    tools,
  });
  const assistant = response.choices[0]?.message ?? {};
  messages.push({
    role: "assistant",
    content: typeof assistant.content === "string" ? assistant.content : null,
    tool_calls: assistant.tool_calls ?? undefined,
  });

  const calls = toolCalls(response);
  if (calls.length === 0) {
    break;
  }

  for (const call of calls) {
    const result = await run(call);
    messages.push(toolResult({ id: call.id, name: call.name, result }));
  }
}
```

The OpenAI-compatible dialect is intentionally not MLX-specific. It targets the
shared `/v1/chat/completions` shape, so hosted OpenAI, Ollama, and local MLX
servers can reuse the same SDK-free translator while the consumer owns endpoint
configuration, credentials, and network calls.

The smart-home agent example dogfoods this boundary with a local MLX path:
`examples/agents/smart-home` exposes `npm run mlx` for a headless prompt and
`npm run demo:mlx` for the same OpenAI-compatible model driving the browser and
terminal bridge over one shared headless runtime. Both paths stay opt-in; CI uses
scripted responses and fake `fetch` instead of a live model server.

## Local model workflow and ecosystem boundaries

The local-model path is deliberately just the OpenAI-compatible dialect plus a
consumer-owned client loop. Ignite does not start, supervise, or vendor an MLX
runtime. A local model server is another OpenAI-compatible provider endpoint:

```bash
python -m pip install mlx-lm
python -m mlx_lm.server --model <model> --port 8080

MLX_BASE_URL=http://127.0.0.1:8080/v1 \
MLX_MODEL=<model> \
npm run mlx -- "turn on the kitchen lights"
```

The same `ignite-element/tools/openai` adapter also works with hosted OpenAI and
Ollama-style `/v1/chat/completions` servers. The consumer owns endpoint selection,
credentials, retry policy, and model process lifecycle; `igniteTools` only owns
the pure manifest/call/result translation and the call into the supplied headless
runtime. That keeps the core SDK-free and avoids a new MLX-specific dependency.

For ecosystem work, the boundaries are:

| Layer | Owns | Does not own |
| --- | --- | --- |
| `ignite-element` | projection, headless `execute`/`observe`, `getSchema`, `igniteTools`, provider dialect translators, examples | durable model-process lifecycle, distributed actor hosting |
| `fas-local` | durable local MLX provider lifecycle, operator setup, process reuse, local model health | Ignite projection semantics or component command contracts |
| `actor-web` | execution/data-plane hosting, topology, actor addresses, future gateway/client transport | Ignite's tool manifest, view projection, or provider dialects |

The smart-home example now exercises two runtime factories:

- default XState runtime: a local deterministic runtime that proves the
  `getSchema` -> `igniteTools` -> `execute` loop with no DOM dependency.
- `SMART_HOME_RUNTIME=actor-web`: an example-local actor-web runtime composed
  through `ignite-element/actor-web`, proving actor-web source projection,
  command execution, and actor-native emitted events through the same
  `igniteTools` loop.

The browser demo bridge remains intentionally local. It proves that a terminal
agent and browser UI can share one Node-owned headless runtime, but it is not the
final actor-web gateway/client transport. Replacing that thin WebSocket shell
with actor-web-hosted transport belongs in actor-web/future integration work,
not in the Ignite tool dialect.

## How the design embodies the principles

| Principle | Where it lives |
| --- | --- |
| **Hexagonal (ports/adapters)** | `ToolDialect` port; `anthropic`/`openai` adapters; core never imports a provider |
| **Functional core / imperative shell** | core = `buildManifest`/`resolveCall` (pure); shell = `run` (`execute` I/O) |
| **DDD boundaries** | domain = manifest/routing; adapters translate + **return facts (no throw)**; shell coordinates |
| **Errors as values** | `resolveCall`/`run` → `Result<…, ToolError>`; the LLM gets the error back as a `tool_result` |
| **Actor model + topology** | agent-actor → `[igniteTools seam]` → component-actor → remote actors; a tool-call *is* a message; location-transparent via actor-web |
| **Projections** | the agent grounds on the **view** (`getView()` / `getSchema().view`), the derived read-model — distinct from the raw snapshot |
| **TDD** | pure core + each dialect = unit-tested with **zero LLM calls** (golden neutral↔provider fixtures); red→green per piece |
| **Manual validation** | headless loop per provider; **Ollama/MLX give a fully-local, key-free loop** (the edge showcase) |

## `ToolError` (errors as values)

A tagged union returned (never thrown) by `resolveCall`/`run`:
`UnknownCommand` · `InvalidInput` (fails the command's `inputSchema`) · `Unavailable`
(`canExecute` false) · `ExecuteFailed` (the command rejected). The consumer maps an `err`
to the provider's `tool_result` (`is_error: true`) so the model can recover.

## Sequencing — three PRs (each: branch off `beta` → TDD/DDD + manual validation → `coderabbit review` → PR `--base beta` → CI + CodeRabbit → approve+merge on green → `fas done`; changeset per PR)

1. **PR 1 — core + `ToolDialect` port + a fake dialect.** ✓ shipped (beta.8). TDD,
   no provider SDK. Proves the neutral core (`buildManifest`/`resolveCall`/`run`
   with `Result`) end-to-end against a fake runtime + fake dialect. Established the
   `ignite-element/tools` entrypoint + the `ToolDialect` interface.
2. **PR 2 — `anthropic` adapter** (`ignite-element/tools/anthropic`). Golden
   neutral↔Anthropic fixtures (TDD); also lands the port's final bare-noun shape +
   the Option D scalar helpers (`tools/scalar.ts`). Manual validation: a headless
   Anthropic loop.
3. **PR 3 — `openai` adapter** (`ignite-element/tools/openai`; covers Codex,
   Ollama, and MLX via OpenAI-compat). Golden fixtures (TDD); reuses the scalar
   helpers + the refined port. Manual validation: headless OpenAI plus a local
   OpenAI-compatible model loop — at minimum MLX for the v3 local-model example —
   proves the port generalizes cloud→local.

## Dependencies

- **typed-view** ✓ + **`getSchema().view`** ✓ (done) — typed manifest inputs + view grounding.
- **`canExecute`** (`docs/can-execute.md`) — composes for availability-gated tools
  by omitting unavailable commands when `igniteTools(runtime)` builds the manifest
  and by re-checking availability when `run()` routes a call. To publish a fresh
  provider tool list after state changes, rebuild `igniteTools(runtime)` or
  re-derive provider tools from a fresh manifest. Older runtimes without the
  optional method still offer all commands for compatibility.

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
