# Tools: named bind, explicit schema, consumer loop

Bind tools with named options. The right path is an explicit `ToolSchema` plus
`igniteTools({ core, schema, canExecute?, dialect? })`. Ordinary core commands
need no metadata. `get('schema')` is minimal discovery, not an input schema
source; discovery does not infer tool schemas.

```ts
import { defineToolSchema, igniteTools } from 'ignite-element/tools';
import { openai, textOf } from 'ignite-element/tools/openai';

const toolSchema = defineToolSchema({
  commands: {
    setLimit: {
      description: 'Set the counter limit.',
      input: { type: 'number', minimum: 3, maximum: 12 },
      gated: true,
    },
  },
});
const tools = igniteTools({
  core,
  schema: toolSchema,
  dialect: openai,
  canExecute: name => name === 'setLimit' && core.get('states').canSetLimit,
});
const { tools: defs, toolCalls, run, toolResult, observe } = tools;
```

`schema` may also be authored with `satisfies ToolSchema`. Retain
JSON-Schema-shaped number/string/boolean/enum/object/array constraints. This is
the built-in structural validator, not Zod and not full JSON Schema. There is no
Zod peer and no core Zod adapter.

`canExecute?: (name: string) => boolean` is one predicate for every
`gated: true` command. Omit it and gated tools stay available (`() => true`).
Do not treat `canExecute` as authentication or authorization; keep source
enforcement. Rebuild the bind when a fresh provider list is needed.

The positional `igniteTools(core, dialect, opts)` overload is removed.

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
  `tool_use` parsing, `tool_result` translation, and `textOf(response)`.
- `ignite-element/tools/openai`: OpenAI-compatible Chat Completions definitions,
  `tool_calls` parsing, role-tool results, and `textOf(response)`; usable with
  compatible OpenAI, Ollama and MLX endpoints.
- No provider SDK runtime dependency, credential handling or network request is
  added. The application brings a client and owns its requests.

The bound `toolCalls(response)` method passes the manifest to its dialect
internally. Scalar inputs are object-wrapped under a strict `value` property at
the provider boundary.

## Command acknowledgement and observation

`run(call)` is **act + ack**. It routes validated input into
`core.execute({ command, input })` and returns `{ result, states, events }` or a
tagged ToolError. A returned promise gates command acknowledgement, not
business-done. Detached work and remote snapshot delivery may still be pending.

`observe(handler)` is the tools fan-in of `on` + `watch` for long/async settle.
Release its handle. Do not invent `waitFor`, `gateFromStates`, or shared/isolated
core factories for tools.

```ts
import { igniteTools } from 'ignite-element/tools';
import { anthropic, textOf } from 'ignite-element/tools/anthropic';

const { tools, toolCalls, run, observe, toolResult } = igniteTools({
  core,
  schema: toolSchema,
  dialect: anthropic,
  canExecute,
});
const subscription = observe(observation => {
  if (observation.type === 'states') console.log(observation.states);
  else console.log(observation.event);
});
try {
  const response = await client.messages.create({ model, messages, tools });
  const calls = toolCalls(response);
  if (calls.length === 0) {
    messages.push({ role: 'assistant', content: textOf(response) });
  }
  for (const call of calls) {
    const result = await run(call);
    blocks.push(toolResult({ id: call.id, name: call.name, result }));
  }
} finally {
  subscription.unsubscribe();
}
```

Without a dialect, `igniteTools({ core, schema })` still exposes `run` and
`observe` for headless proof. UI registration uses the callable core:
`home('smart-home', renderer)`. There is no `view:` callback on `igniteCore`.

## OpenAI-compatible and local-model loops

```ts
import { igniteTools } from 'ignite-element/tools';
import { openai, textOf } from 'ignite-element/tools/openai';

const { tools, toolCalls, run, toolResult } = igniteTools({
  core,
  schema: toolSchema,
  dialect: openai,
  canExecute,
});
for (let turn = 0; turn < 8; turn++) {
  const response = await client.chat.completions.create({
    model,
    messages,
    tools,
  });
  const assistant = response.choices[0]?.message ?? {};
  messages.push({
    role: 'assistant',
    content: typeof assistant.content === 'string' ? assistant.content : null,
    tool_calls: assistant.tool_calls ?? undefined,
  });
  const calls = toolCalls(response);
  if (calls.length === 0) {
    console.log(textOf(response));
    break;
  }
  for (const call of calls) {
    const result = await run(call);
    messages.push(toolResult({ id: call.id, name: call.name, result }));
  }
}
```

For a raw fetch client, pass the parsed Chat Completions JSON to `toolCalls`,
not a Response object. Endpoint selection, credentials, cancellation, retry and
process lifetime belong to the application.

Example-local opt-in commands remain:

```sh
python -m pip install mlx-lm
python -m mlx_lm.server --model <model> --port 8080

MLX_BASE_URL=http://127.0.0.1:8080/v1 MLX_MODEL=<model> npm run mlx -- "turn on the kitchen lights"
VITE_MLX_BASE_URL=http://127.0.0.1:8080/v1 VITE_MLX_MODEL=<model> pnpm --dir examples/agents/voice-workbench dev
```

Smart Home uses XState with Anthropic and OpenAI-compatible model loops, and a
terminal/browser bridge sharing a headless runtime. Its explicit
`homeToolSchema` is the consumer path: named `igniteTools` plus `tools` /
`toolCalls` / `run` / `toolResult` / `observe`.

Voice Workbench retains its source-owned artifact and stale-result policies.
CI uses scripted model responses and fake fetch, not a live model provider.

## Errors and verification

`run` returns tagged errors: `UnknownCommand`, `InvalidInput`, `Unavailable`,
`ExecuteFailed`. Provider translators turn those results into provider result
blocks so a model can react. Missing required schema is a construction error,
not a hidden fallback.

Headless proof is the Smart Home example running in the Vitest `node`
environment with no DOM.

Advanced/testing still export `buildManifest` and `resolveCall`. Application
loops and everyday docs should not import them.

See [availability](can-execute.md), [core API](core-api-bindings.md),
[React](ignite-react.md), and [projection runtime](projection-runtime.md).

## Adapter ownership

| Source mode | Teardown |
| --- | --- |
| Neutral Actor-Web source or factory | Detaches with `ownsFactorySource: false`; native shutdown stays with the caller/Actor-Web |
| Explicit Actor-Web web host factory | Closes its owned source handle according to the adapter contract |

The low-level Actor-Web adapter factory has separate capability defaults; do not
infer its ownership from the neutral facade. Owned handle close can be
asynchronous while `core.dispose()` remains synchronous and does not await remote
shutdown. Borrowing an XState actor currently starts it.

Native completion does not dispose a core. Retain completed results until the
application owner explicitly tears it down.
