# Tools: explicit schemas over a headless core

The v3 development candidate retains the SDK-neutral tools core and provider
dialects while removing helper-dependent automatic core schemas. A tool
definition is application-owned; ordinary core commands require no metadata.

`get('schema')` is minimal discovery, not an input schema source. Its null input
schemas mean unknown. Automatic `igniteTools(core)` construction fails clearly
when required schemas are missing, before executing a source command. Keep
existing descriptions, constraints and availability rules at the application
boundary instead of inventing empty-object inputs or exposing all actions.

## Explicit authoring and the functional core

```ts
import { buildManifest, resolveCall, igniteTools } from 'ignite-element/tools';
import { openai } from 'ignite-element/tools/openai';

const toolSchema = {
  commands: {
    setLimit: {
      description: 'Set the counter limit.',
      input: { type: 'number', minimum: 3, maximum: 12 },
      gated: true,
    },
  },
};
const canExecute = (name: string) =>
  name === 'setLimit' && core.get('states').canSetLimit;
const manifest = buildManifest(toolSchema, canExecute);
const valid = resolveCall(manifest, 'setLimit', 6, canExecute);
const invalid = resolveCall(manifest, 'setLimit', 99, canExecute);
const tools = igniteTools(core, openai, { schema: toolSchema, canExecute });
```

`buildManifest(schema, canExecute?)` reads explicit command definitions, sorts
names, and omits currently unavailable explicitly gated commands.
`resolveCall(manifest, name, input, canExecute?)` validates supported input
constraints and current availability, returning a route or a tagged error.
Neither is a provider SDK or a source policy engine.

Input definitions support number/string/boolean/enum/object/array constraints,
including scalar bounds, string length/pattern, required properties and nested
items. This is the retained structural validator, not a claim of full JSON Schema
compliance. An intentionally no-argument tool may have its own explicit empty
object contract; an unknown function must not be assigned one automatically.

Availability predicates remain independent application policy, not a removed
`core.canExecute` method. Project source-native availability into states, read it
at routing time and keep source enforcement. Rebuild offered tools when a fresh
provider list is needed; stale preflight is not authorization.

## Provider port

`ToolDialect<Tools, Response, ResultBlock>` has three pure methods:

```ts
interface ToolDialect<Tools, Response, ResultBlock> {
  tools(manifest: NeutralManifest): Tools;
  toolCalls(response: Response, manifest: NeutralManifest): NeutralToolCall[];
  toolResult(result: NeutralToolResult): ResultBlock;
}
```

- `ignite-element/tools/anthropic`: Anthropic Messages tool definitions,
  `tool_use` parsing and `tool_result` translation.
- `ignite-element/tools/openai`: OpenAI-compatible Chat Completions definitions,
  `tool_calls` parsing and role-tool results; usable with compatible OpenAI,
  Ollama and MLX endpoints.
- No provider SDK runtime dependency, credential handling or network request is
  added. The application brings a client and owns its requests.

The neutral manifest is scalar-honest. At provider boundaries,
`toProviderInputSchema` wraps scalar inputs under a strict `value` property;
`fromProviderInput` unwraps only when the manifest is scalar. A legitimate object
input containing its own `value` field is not unwrapped. Extra keys remain visible
to validation. The bound `toolCalls(response)` method passes the manifest to its
dialect internally.

## Command acknowledgement and observation

`run(call)` routes validated input into `core.execute({ command, input })`.
It returns a Result containing `{ snapshot, states, events }`, or a ToolError.
The snapshot and derived states are paired after the callback and queued
observation window. This is not a promise that asynchronous network, persistence
or remote business work is complete, nor an independently correlated receipt for
overlapping calls.

`observe(handler)` streams declared outward events and derived-state transitions
through the core's `on` and `watch` subscriptions. Release its handle. The owner
disposes an unregistered core after all borrowed surfaces finish; provider loops
do not silently seize source lifetime.

```ts
import { igniteTools } from 'ignite-element/tools';
import { anthropic } from 'ignite-element/tools/anthropic';

const { tools, toolCalls, run, observe, toolResult } =
  igniteTools(core, anthropic, { schema: toolSchema, canExecute });
const subscription = observe(observation => {
  if (observation.type === 'states') console.log(observation.states);
  else console.log(observation.event);
});
try {
  const response = await client.messages.create({ model, messages, tools });
  for (const call of toolCalls(response)) {
    const result = await run(call);
    blocks.push(toolResult({ id: call.id, name: call.name, result }));
  }
} finally {
  subscription.unsubscribe();
}
```

Without a dialect, `igniteTools(core, undefined, { schema, canExecute })` exposes
the neutral `manifest`, `resolveCall`, `run` and `observe` surface.

## OpenAI-compatible and local-model loops

```ts
import { igniteTools } from 'ignite-element/tools';
import { openai } from 'ignite-element/tools/openai';

const { tools, toolCalls, run, toolResult } =
  igniteTools(core, openai, { schema: toolSchema, canExecute });
for (let turn = 0; turn < 8; turn++) {
  const response = await client.chat.completions.create({ model, messages, tools });
  const assistant = response.choices[0]?.message ?? {};
  messages.push({
    role: 'assistant',
    content: typeof assistant.content === 'string' ? assistant.content : null,
    tool_calls: assistant.tool_calls ?? undefined,
  });
  const calls = toolCalls(response);
  if (calls.length === 0) break;
  for (const call of calls) {
    const result = await run(call);
    messages.push(toolResult({ id: call.id, name: call.name, result }));
  }
}
```

For a raw fetch client, pass the parsed Chat Completions JSON to `toolCalls`,
not a Response object. Endpoint selection, credentials, cancellation, retry and
process lifetime belong to the application. Ignite does not start or supervise
a local model server.

Example-local opt-in commands remain:

```sh
python -m pip install mlx-lm
python -m mlx_lm.server --model <model> --port 8080

MLX_BASE_URL=http://127.0.0.1:8080/v1 MLX_MODEL=<model> npm run mlx -- "turn on the kitchen lights"
VITE_MLX_BASE_URL=http://127.0.0.1:8080/v1 VITE_MLX_MODEL=<model> pnpm --dir examples/agents/voice-workbench dev
```

These are application setup examples, not actions performed by package validation.

Smart Home retains XState and `SMART_HOME_RUNTIME=actor-web` paths, Anthropic and
OpenAI-compatible model loops, and a terminal/browser bridge sharing a headless
runtime. Its explicit `homeToolSchema` preserves command descriptions and inputs.

Voice Workbench retains its source-owned artifact and stale-result policies,
projection channels and semantic model-command selection. Its explicit model
definitions do not turn user intents into fabricated no-input tools. Unknown
model calls and invalid payloads remain rejected before source execution.
CI uses scripted model responses and fake fetch, not a live model provider.

Actor-Web owns execution, topology, admission, transport, replay and runtime
shutdown. Ignite adapts source facts; it does not become an actor gateway or
distributed supervisor. A local WebSocket demo is not evidence of production
Actor-Web transport or durable model-process hosting.

## Errors and verification

`resolveCall` and `run` return tagged errors:
`UnknownCommand`, `InvalidInput`, `Unavailable`, `ExecuteFailed`.
Provider translators turn those results into provider result blocks so a model
can react. Missing required schema is a construction error, not a hidden fallback.

Retained tests cover nested invalid payloads, scalar wrap/unwrap, availability
changes, source rejection, provider translation, asynchronous/stale-result
scenarios and projection safety. No new provider SDK, global schema registry or
core authoring helper is required.

See [availability](can-execute.md), [core API](core-api-bindings.md),
[React](ignite-react.md), and [projection runtime](projection-runtime.md).
