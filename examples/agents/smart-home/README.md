# Headless smart-home agent (igniteTools + Anthropic)

A virtual smart home (lights, thermostat, blinds, door locks, scenes) built as an
ordinary `ignite-element` component and **driven by Claude** through
`igniteTools` + the `ignite-element/tools/anthropic` adapter — running **fully
headless in Node, with no DOM and no jsdom**.

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

# the real loop — Claude drives the home
npm install @anthropic-ai/sdk
ANTHROPIC_API_KEY=sk-... npm run anthropic -- "it's movie night"

# terminal agent + browser UI, sharing one live headless home
npm run demo

# the always-on assertions (this is what proves it runs headless)
npm test
```

`npm run demo` serves <http://localhost:5177>. The scripted terminal agent starts
automatically and browser clicks route back into the same shared headless
runtime. The WebSocket bridge is intentionally small and local to this example;
it stands in for actor-web-native location transparency until that integration is
available.

The terminal is also interactive. Type commands such as `scene away`,
`light kitchen on`, `temp bedroom 72`, or `status` at the `smart-home>` prompt;
they use the same `igniteTools.run()` path as the browser and broadcast the
updated view back to the page.

## The loop

```
getSchema()  →  anthropic.tools(manifest)  →  [ model ]  →  tool_use
     ▲                                                          │
     └──  tool_result  ←  anthropic.toolResult  ←  run()  ←  toolCalls()
```

`igniteTools(home, anthropic)` returns `{ tools, toolCalls, run, toolResult }`.
The consumer brings the model (the `Model` seam in `src/model.ts`: a scripted
mock or the real `@anthropic-ai/sdk`) and runs the loop in `src/agentLoop.ts`.

## What it exercises

- **DOM-free runtime** — the whole thing runs in the Vitest `node` environment
  (see `vite.config.ts`); `getSchema`/`execute`/`on`/`watchView` need no DOM.
- **Varied command schemas** — object (`toggleLight`, `setThermostat`,
  `setBlinds`), scalar enum (`lockDoor`, `unlockDoor`, `runScene`), array
  (`dimRooms`), and no-arg (`status`) — all translated to Anthropic tool defs.
- **Option D value-wrap round-trip** — a non-object single-arg command
  (`lockDoor(door)`, `dimRooms(rooms)`) is object-wrapped as `{ value }` for the
  model and unwrapped on the way back.
- **Errors as values** — an out-of-range input comes back as an `InvalidInput`
  `tool_result` (never a throw), so the model can recover.
- **Events as observations** — `runScene` emits `scene-applied`, captured in the
  command window.
- **Terminal-to-browser bridge** — `src/server.ts` hosts one canonical headless
  home, `igniteTools(...).observe()` broadcasts state changes, and
  `<smart-home-bridge>` renders the same runtime as an Ignite web component.

## Gaps found

Dogfooding this surfaced several real gaps (view-vs-snapshot grounding,
`canExecute` availability gating, an `observe()` channel, async/settle, array
input coverage). See
[`GAPS.md`](./GAPS.md).
