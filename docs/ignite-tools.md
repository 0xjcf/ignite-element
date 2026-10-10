# Tools: named bind, explicit schema, consumer loop

Published docs: [Tools](https://0xjcf.github.io/ignite-element/guides/tools/).

Bind tools with named options. The right path is an explicit `ToolSchema` plus
`igniteTools({ core, schema, canExecute?, dialect? })`. Ordinary core commands
need no metadata. `get('schema')` is minimal discovery, not an input schema
source; discovery does not infer tool schemas.

```ts
import { defineToolSchema, igniteTools } from 'ignite-element/tools';
import { openai, textOf } from 'ignite-element/tools/openai';

const toolSchema = defineToolSchema({
  setLimit: {
    description: 'Set the counter limit.',
    input: { type: 'number', minimum: 3, maximum: 12 },
    gated: true,
  },
});
const tools = igniteTools({
  core,
  schema: toolSchema,
  dialect: openai,
  canExecute: name => name === 'setLimit' && core.get('states').canSetLimit,
});
const { tools: defs, toolCalls, run, toolResult, until, observe } = tools;
```

`schema` may also be authored with `satisfies ToolSchema`. `ToolSchema` is a
bare command map: `{ setLimit: { input, description?, gated? } }`. Retain
JSON-Schema-shaped number/string/boolean/enum/object/array constraints. This is
the built-in structural validator, not Zod and not full JSON Schema. Unknown
`type` strings are rejected at `defineToolSchema`. There is no Zod peer and no
core Zod adapter.

`canExecute?: (name: string) => boolean` is the explicit allow for commands.
Omit it and commands are denied. An ungated `read: true` tool stays available,
and so do `observe` and `until`. `gated: true` rechecks the predicate.
`canExecute` is availability preflight; source guards still enforce.

A `consequential: true` command is not an ungated read. It stays denied unless
`canExecute` returns true. The application owns the single-use approval
`{ actor, name, input, target, id, expiresAt }`, bound to the user, the tool
name, the exact input, and the target runtime. The predicate closes over that
application authority. Ignite does not validate, store, or consume the record.
A boolean `confirmed` flag is not an approval. `run` calls
`core.execute({ command, input })`.
Rebuild the bind when a fresh provider list is needed.

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

`until(match)` waits on the same observation stream as `observe` and resolves
with the first defined match. On attach, `watch` delivers the current projection
once with `prevStates === undefined`, then waits for further emissions if that
delivery does not match. Match returning `undefined`, `false`, or nullish means keep waiting. Matchers are
synchronous. It unsubscribes when it resolves. Pass `{ signal }` to cancel:
abort unsubscribes and rejects with an `AbortError`.

`observe(handler)` remains for ongoing fan-in — logging, multiple listeners, or
long-lived loops.

```ts
const { run, until, observe } = tools;
const result = await run({ name: 'setLimit', input: 6 });
if (result.ok) {
  console.log(result.value);
}
const states = await until(
  (observation) =>
    observation.type === 'states' && observation.states.limit === 6
      ? observation.states
      : undefined,
);
```

Without a dialect, `igniteTools({ core, schema })` still exposes `run`, `until`,
and `observe` for headless proof. UI registration uses the callable core:
`home('smart-home', renderer)`.

## OpenAI-compatible and local-model loops

The application owns the client, credentials, and requests.
Push the user request onto `messages` before the loop.

```ts
import { igniteTools } from 'ignite-element/tools';
import { openai, textOf } from 'ignite-element/tools/openai';

const { tools, toolCalls, run, toolResult } = igniteTools({
  core,
  schema: toolSchema,
  dialect: openai,
  canExecute,
});
messages.push({
  role: 'user',
  content: 'Set the limit to 6 and increment until it is reached.',
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
`toolCalls` / `run` / `until` / `toolResult` / `observe`.

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
