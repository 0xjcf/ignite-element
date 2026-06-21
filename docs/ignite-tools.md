# Design: `igniteTools(component)` — getSchema → LLM tool-use bridge

## Status

Proposed (design ✓). **Additive**, non-breaking — `3.x` minor. The agent analog of
`ignite-element/react`. Agent-runtime thread in `docs/v3-stable-roadmap.md`.

## Context

`getSchema()` already describes a component as a machine-readable contract — `commands`
(name + input schema), `events`, `snapshot` (+ `view`). With headless
`execute(name, payload)`, that's everything an LLM agent needs to *drive* a component:
discover tools, call them, observe results. But wiring `getSchema` → an LLM SDK's tool
format and routing `tool_use` → `execute` is boilerplate every consumer would re-write.

`igniteTools(component)` is that bridge — the agent analog of `igniteReact(component)`:
both are thin, schema-driven adapters from the ignite contract to a host runtime (React
render / LLM tool-use).

## Decision

```ts
import { igniteTools } from "ignite-element/tools";

const { tools, invoke } = igniteTools(release);
```

- **`tools`** — a tool manifest derived from `getSchema().commands`: each command →
  `{ name, description, inputSchema }` (the input schema is the command's
  `command.object/…` metadata as JSON Schema). **Availability-gated**: a command whose
  `getSchema` entry is `gated` and whose `canExecute(name)` is currently `false` is
  **omitted**, so the agent only sees currently-callable tools (dynamic tool
  availability; see `docs/can-execute.md`).
- **`invoke(toolUse)`** — routes an LLM `tool_use` block (`{ name, input }`) into
  `component.execute(name, input)` and returns `{ snapshot, events }` (flat tagged event
  members). The act+observe step of the loop.
- **Observations** — `events` (flat members) and `getView()` (the display projection)
  are what the agent grounds its next turn on. The component holds state, so the agent
  re-grounds on `getView()` each turn instead of replaying history.

### SDK-neutral core + optional helper

The core returns a neutral manifest (`{ name, description, inputSchema }[]`) + `invoke`,
with **no hard dependency on any LLM SDK**. An optional Anthropic-shaped mapping
(emitting `@anthropic-ai/sdk`'s `Tool` shape and reading its `ToolUseBlock`) is provided
as a thin helper; `@anthropic-ai/sdk` stays an **optional peer** (mirroring react's
optional peer) so the core chunk never imports it. This keeps the "no lock-in" promise
at the agent-SDK layer too.

## North-star DX — the release-agent loop

One `igniteCore`, driven headless. The component is backed by a **remote** actor-web
actor (location-transparent; the deploy controller runs on CI/edge), so the agent drives
a possibly-distributed system through one local typed contract.

```ts
// release-actor.ts — authored once. Commands carry availability predicates (canExecute).
export const release = igniteCore({           // ignite-element/actor-web
  source: connectReleaseActor,                // remote source
  view: ({ snapshot }) => ({
    summary: `${snapshot.context.service}@${snapshot.context.sha.slice(0, 7)} — ${snapshot.context.stage}`,
    connected: snapshot.transport.state === "connected",
  }),
  commands: ({ actor }) => ({
    build:   command(() => actor.send({ type: "BUILD" }),   { available: (s) => s.transport.state === "connected" && s.context.stage === "idle" }),
    deploy:  command((i: { env: "staging" | "prod" }) => actor.send({ type: "DEPLOY", env: i.env }), {
      input: command.object({ env: command.enum(["staging", "prod"]) }),
      available: (s) => s.transport.state === "connected" && s.context.stage === "built",
    }),
    promote: command(() => actor.send({ type: "PROMOTE" }), { available: (s) => s.transport.state === "connected" && s.context.stage === "verified" }),
    rollback:command(() => actor.send({ type: "ROLLBACK" }),{ available: (s) => s.transport.state === "connected" && ["deploying","deployed","verified"].includes(s.context.stage) }),
  }),
});
```

```ts
// release-agent.ts — headless. No DOM. A CLI / CI step.
for (let turn = 0; turn < 12; turn++) {
  const { tools, invoke } = igniteTools(release);   // only currently-callable commands (canExecute-gated)
  const view = release.getView();
  if (!tools.length) { await wait(1000); continue; } // disconnected ⇒ every transport-check false ⇒ no tools

  const res = await anthropic.messages.create({
    model: "claude-opus-4-8", max_tokens: 1024, tools,
    messages: [{ role: "user", content: `${goal}\nstate: ${JSON.stringify(view)}` }],
  });
  const call = res.content.find((b) => b.type === "tool_use");
  if (!call) break;                                  // agent is done
  const { events } = await invoke(call);             // tool_use → release.execute(name, input)
  for (const e of events) console.log(`⚡ ${e.type}`, e); // flat member: { type: "deployed", env: "staging" }
}
```

The agent code holds **no deployment logic and no state machine**: it reads available
tools + the view and acts. The action space is always valid — it is impossible to offer
`promote` before `verify`, so you never prompt-engineer "don't promote early." The
contract enforces it. The tools list narrows turn-by-turn (`build` → `deploy, rollback`
→ `promote, rollback` → none) purely from `canExecute`.

## Two-surface boundary

`igniteTools` consumes the **headless/agent surface** (`getSchema` / `execute` /
`canExecute` / `getView`). It is NOT how a component's own UI is authored — that derives
from the destructured callback args, source-native (`snapshot.can`, `actor.send` via
commands). A single `igniteCore` can power a web UI (source-native view/commands) **and**
an agent (`igniteTools`) — one contract, two consumers, zero shared glue.

## Dependencies

- **typed-view** (`1781971975611`) — typed `getView()` so observations/tool inputs are typed.
- **`getSchema().view`** — view grounding in the contract.
- **`canExecute`** (`docs/can-execute.md`) — the availability gating. Without it `tools`
  includes all commands (no dynamic gating; still functional, just ungated).

## Alternatives considered

- **Bake in an LLM SDK** — rejected: locks the agent SDK; neutral core + optional helper
  keeps it open.
- **Offer all tools, let `execute` reject** — rejected for gated commands: wastes an LLM
  turn and pollutes the transcript; `canExecute` pre-gating is cleaner. (Arg-validity
  still surfaces at `execute` time — availability ≠ validity.)
- **A bespoke per-component tool wrapper** — rejected: `getSchema` already carries the
  contract; derive, don't hand-write.

## Impact

Additive. New entrypoint `ignite-element/tools` (`agent-tools.ts`), manifest/invoke
types, an optional Anthropic helper, a docs/site agent page, changeset (minor). No change
to existing surfaces.

## Related

- `docs/can-execute.md`, `docs/ignite-react.md` (the sibling schema-driven wrapper).
- `docs/v3-api-consistency.md`, `docs/v3-stable-roadmap.md`.
- Memory: `v3-api-consistency-epic`.
