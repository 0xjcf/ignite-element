# v3 Headless Smart-Home Agent Screencast

## Goal

Record a 3-5 minute release demo that shows Ignite Element as a behavior
contract for people, tests, and agents:

- define one smart-home contract once,
- inspect the agent-readable command surface,
- execute commands headlessly in Node,
- drive the same runtime from a terminal agent and browser UI,
- optionally swap to actor-web and a local MLX/OpenAI-compatible model.

The guaranteed recording path is the deterministic scripted model. MLX and
actor-web are optional proof points, not prerequisites for the main take.

## Setup

From a clean repo checkout:

```bash
pnpm install
cd examples/agents/smart-home
pnpm install --ignore-workspace --link-workspace-packages=false
npm test
```

For the guaranteed key-free demo:

```bash
npm run mock
npm run demo
```

For actor-web-backed dogfood:

```bash
SMART_HOME_RUNTIME=actor-web npm run mock
SMART_HOME_RUNTIME=actor-web npm run demo
```

For optional local MLX/OpenAI-compatible recording:

```bash
python -m pip install mlx-lm
python -m mlx_lm.server --model <model> --port 8080

MLX_MODEL=<model> npm run mlx -- "it's bedtime"
MLX_MODEL=<model> npm run demo:mlx
```

Use `MLX_BASE_URL` or `OPENAI_COMPAT_BASE_URL` to point at a different
OpenAI-compatible endpoint. Use `OPENAI_COMPAT_API_KEY` only when the endpoint
requires one.

## Recording Flow

### 0:00 - Open with the contract

Show the docs page
`/ignite-element/overview/ignite-for-ai-agents/`.

Narration:

> Ignite Element gives agents a behavior contract instead of asking them to
> scrape the DOM. The same component exposes a custom element for people and a
> headless runtime for tools.

Cut to `examples/agents/smart-home/src/home.ts` around `createHome()`.

Show that `createHome()` returns the runtime surface:

- `getSchema()`
- `execute()`
- `getView()`
- `on()`
- `watchView()`

Point at the command metadata for `toggleLight`, `setThermostat`, `runScene`,
`dimRooms`, and `status`. Call out that scalar, object, array, and no-argument
commands all become model tool inputs.

### 0:45 - Show schema to tools

Open `examples/agents/smart-home/src/agentLoop.ts`.

Narration:

> The agent loop never queries the DOM. `igniteTools(home, dialect)` reads the
> runtime schema, turns it into provider tool definitions, runs validated tool
> calls through `execute()`, then gives the model the result as a tool response.

Show the loop shape:

```text
getSchema -> tools -> model tool call -> run -> execute -> tool result
```

Point out that the provider dialect can be Anthropic or OpenAI-compatible, while
the Ignite runtime contract stays the same.

### 1:30 - Run the guaranteed headless path

Run:

```bash
cd examples/agents/smart-home
npm run mock
```

Show the terminal output:

- initial state,
- scripted prompt,
- `toggleLight`, `setThermostat`, `lockDoor`, and `runScene` tool calls,
- final projected view.

Narration:

> This is a real Ignite runtime in Node. The scripted model makes the recording
> deterministic, and the same path is covered by tests with no DOM and no live
> model server.

### 2:10 - Show terminal and browser sharing one runtime

Start the bridge:

```bash
npm run demo
```

Open <http://localhost:5177>.

In the terminal prompt, run:

```text
status
light kitchen on
temp bedroom 72
scene away
```

Show the browser updating after each terminal command.

Then click a browser control:

- turn a room light on or off,
- run the `Movie` or `Morning` scene,
- lock or unlock a door.

Show the terminal receiving the same updated view.

Narration:

> The Node process owns one headless runtime. The terminal agent and the browser
> bridge both use the same command/view contract, so changes made on either side
> stay synchronized.

### 3:20 - Optional actor-web runtime swap

Stop the server and restart:

```bash
SMART_HOME_RUNTIME=actor-web npm run demo
```

Repeat one terminal command and one browser click.

Narration:

> The runtime can be XState-backed or actor-web-backed. Ignite still owns the
> projection, schema, commands, and tool loop. Actor-Web owns the long-lived
> runtime and emitted domain events.

Keep this segment short. It is a proof of boundary alignment, not a deep
actor-web walkthrough.

### 4:00 - Optional local MLX model

In a separate terminal, start an OpenAI-compatible MLX server:

```bash
python -m mlx_lm.server --model <model> --port 8080
```

Run either:

```bash
MLX_MODEL=<model> npm run mlx -- "turn off all lights and lock every door"
```

or:

```bash
MLX_MODEL=<model> npm run demo:mlx
```

Narration:

> MLX works through the OpenAI-compatible dialect. Ignite does not own model
> process lifecycle or durable local-model serving; it owns the tool contract
> and the command execution against the component runtime.

If the local model is slow or unavailable, skip this segment and use the
deterministic mock recording.

### 4:40 - Close

Return to the docs page or README.

Narration:

> The point is not a special smart-home app. The point is the shape: one Ignite
> behavior contract, a DOM projection for humans, and a headless runtime that
> tests and agents can drive without selectors.

## Backup Plan

If the browser bridge or local MLX path is unstable during recording, use this
shorter path:

1. Show `home.ts` and `agentLoop.ts`.
2. Run `npm test`.
3. Run `npm run mock`.
4. Show the README commands for `npm run demo` and `npm run demo:mlx`.

This still proves the release-critical message: the behavior contract is
headless, deterministic, and provider-neutral.

## Links

- Docs one-pager: `docs/site/src/content/docs/overview/ignite-for-ai-agents.mdx`
- Agent guide: `docs/site/src/content/docs/guides/agent-runtime-v3.mdx`
- Headless runtime reference:
  `docs/site/src/content/docs/api/headless-runtime.mdx`
- Smart-home example: `examples/agents/smart-home`
- Tool dialect docs: `docs/ignite-tools.md`
