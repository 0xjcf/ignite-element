# Headless smart-home agent (igniteTools + local/cloud models)

A virtual smart home (lights, thermostat, blinds, door locks, scenes) built as an
ordinary `ignite-element` component and **driven by an LLM** through
`igniteTools` + provider adapters — running **fully headless in Node, with no
DOM and no jsdom**.

It's the agent analog of the other examples: instead of a person clicking a UI,
an LLM reads the component's `getSchema()`, calls its commands as tools, and
observes the result — the same `getSchema()` / `execute()` contract, no UI layer.
The Phase C demo also exposes that same live home through a browser UI: a Node
process owns the headless runtime, a terminal agent drives it with `igniteTools`,
and the browser `<smart-home-bridge>` element observes and sends commands over a thin
WebSocket bridge.

## Run it

```bash
# key-free, deterministic — a scripted "model" drives the home (no API key)
npm run mock
SMART_HOME_RUNTIME=actor-web npm run mock

# the real loop — Claude drives the home
npm install @anthropic-ai/sdk
ANTHROPIC_API_KEY=sk-... npm run anthropic -- "it's movie night"
SMART_HOME_RUNTIME=actor-web ANTHROPIC_API_KEY=sk-... npm run anthropic -- "it's movie night"

# fully local loop — MLX exposes an OpenAI-compatible endpoint
python -m pip install mlx-lm
python -m mlx_lm.server --model <model> --port 8080
MLX_MODEL=<model> npm run mlx -- "it's bedtime"
SMART_HOME_RUNTIME=actor-web MLX_MODEL=<model> npm run mlx -- "it's bedtime"

# terminal agent + browser UI, sharing one live headless home
npm run demo
SMART_HOME_RUNTIME=actor-web npm run demo

# local MLX/OpenAI-compatible agent + browser UI, sharing one live home
MLX_MODEL=<model> npm run demo:mlx
SMART_HOME_RUNTIME=actor-web MLX_MODEL=<model> npm run demo:mlx

# the always-on assertions (this is what proves it runs headless)
npm test
```

Set `SMART_HOME_RUNTIME=actor-web` to swap the default XState-backed home for an
example-local actor-web runtime composed through `ignite-element/actor-web`.

`npm run demo` serves <http://localhost:5177>. The scripted terminal agent starts
automatically and browser clicks route back into the same shared headless
runtime. The WebSocket bridge is still intentionally small and example-local:
the runtime behind it can now be actor-web-backed, but the browser transport is
still a thin local WebSocket demo rather than the actor-web gateway/client path.

The terminal is also interactive. Type commands such as `scene away`,
`light kitchen on`, `temp bedroom 72`, or `status` at the `smart-home>` prompt;
they use the same `igniteTools.run()` path as the browser and broadcast the
updated view back to the page.

`npm run mlx` and `npm run demo:mlx` default to
`http://127.0.0.1:8080/v1`. Override with `MLX_BASE_URL` or
`OPENAI_COMPAT_BASE_URL`; use `MLX_MODEL` or `OPENAI_COMPAT_MODEL` for the model
name. Tests use scripted responses and injected `fetch`, so CI never needs an
installed MLX model or a live network server.

## The loop

```
getSchema()  →  dialect.tools(manifest)  →  [ model ]  →  tool call
     ▲                                                          │
     └──  tool result  ←  dialect.toolResult  ←  run()  ←  toolCalls()
```

`igniteTools(home, anthropic)` and `igniteTools(home, openai)` both return
`{ tools, toolCalls, run, toolResult }`. The consumer brings the model seam in
`src/model.ts`: a scripted mock, the real `@anthropic-ai/sdk`, or any
OpenAI-compatible `/v1/chat/completions` server such as MLX.

## What it exercises

- **DOM-free runtime** — the whole thing runs in the Vitest `node` environment
  (see `vite.config.ts`); `getSchema`/`execute`/`on`/`watchView` need no DOM.
- **Varied command schemas** — object (`toggleLight`, `setThermostat`,
  `setBlinds`), scalar enum (`lockDoor`, `unlockDoor`, `runScene`), array
  (`dimRooms`), and no-arg (`status`) — all translated to Anthropic tool defs.
- **Option D value-wrap round-trip** — a non-object single-arg command
  (`lockDoor(door)`, `dimRooms(rooms)`) is object-wrapped as `{ value }` for the
  model and unwrapped on the way back.
- **Provider-independent tool loop** — the same headless runtime runs with the
  Anthropic Messages shape or OpenAI-compatible Chat Completions shape.
- **Runtime injection seam** — the same provider loops can drive the existing
  local home runtime or an actor-web-backed Ignite runtime selected with
  `SMART_HOME_RUNTIME=actor-web`.
- **Errors as values** — an out-of-range input comes back as an `InvalidInput`
  `tool_result` (never a throw), so the model can recover.
- **Actor-web native emits** — in actor-web mode, `runScene` emits
  `scene-applied` from the runtime itself and `igniteTools.run()` captures it in
  the command window.
- **Terminal-to-browser bridge** — `src/server.ts` hosts one canonical headless
  home, `igniteTools(...).observe()` broadcasts state changes, and
  `<smart-home-bridge>` renders the same runtime as an Ignite web component.

## Gaps found

Dogfooding this surfaced several real gaps (view-vs-snapshot grounding,
`canExecute` availability gating, an `observe()` channel, async/settle, array
input coverage). See
[`GAPS.md`](./GAPS.md).
