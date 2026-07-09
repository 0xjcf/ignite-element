# Design: Projection runtime over behavior contracts

## Status

Proposed for the Ignite Element v3 beta design window. This document defines
the documentation-level contract for projection selection without introducing
new runtime exports in this task.

## Why a projection runtime

Ignite already has the right behavior boundary:

- `view` derives stable UI-facing state from the source snapshot.
- `getView()` returns that derived state to headless consumers.
- `getSchema()` returns JSON-serializable commands, events, snapshot, and view.
- `execute()` and `canExecute()` keep intent and availability explicit.

That contract is enough to avoid DOM scraping, but multi-channel consumers still
need one more layer: a deterministic way to ask for a known projection over the
same behavior facts. A browser UI, a screen reader-oriented summary, a voice
response, and an agent tool response should all start from the same runtime
state instead of inventing parallel callback systems.

The projection runtime adds that layer. It does not replace `view`,
`getView()`, or `getSchema()`, and it does not make the internal
`createProjectionFactory` helper public.

## Glossary

- `view`: Ignite's existing derived-state callback.
- `getView()`: the existing headless read of the current derived view.
- `getSchema()`: the existing JSON-serializable runtime contract.
- `ProjectionRequest`: a serializable request for a known projection.
- `ProjectionContext`: immutable runtime facts available during selection.
- `ProjectionSpec`: an application-authored registry entry.
- `ProjectionInstance`: the resolved projection result.
- `ProjectionResolution`: the typed success or no-match result.

## Contract shapes

These are docs-level shapes for the accepted design direction. They are not
production exports in this task.

```ts
type ProjectionChannel = "dom" | "voice" | "assistive" | "agent";

interface ProjectionRequest {
  readonly projectionId?: string;
  readonly channel: ProjectionChannel;
  readonly intent?: string;
  readonly locale?: string;
  readonly capabilities?: readonly string[];
}

interface ProjectionContext<TSnapshot, TView, TSchema> {
  readonly snapshot: TSnapshot;
  readonly view: TView;
  readonly schema: TSchema;
  readonly channel: ProjectionChannel;
  readonly locale?: string;
  canExecute(name: string): boolean;
}

interface ProjectionSpec<TSnapshot, TView, TSchema, TFacts, TOutput> {
  readonly id: string;
  readonly channel: ProjectionChannel;
  readonly priority?: number;
  supports(
    request: ProjectionRequest,
    context: ProjectionContext<TSnapshot, TView, TSchema>,
  ): boolean;
  resolve(
    context: ProjectionContext<TSnapshot, TView, TSchema>,
    request: ProjectionRequest,
  ): ProjectionInstance<TFacts, TOutput>;
}

interface ProjectionInstance<TFacts, TOutput> {
  readonly projectionId: string;
  readonly channel: ProjectionChannel;
  readonly request: ProjectionRequest;
  readonly facts: TFacts;
  readonly output: TOutput;
}

type ProjectionResolution<TFacts, TOutput> =
  | {
      readonly ok: true;
      readonly instance: ProjectionInstance<TFacts, TOutput>;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "unknown-projection"
        | "projection-unavailable"
        | "no-channel-match";
      readonly request: ProjectionRequest;
      readonly availableProjectionIds: readonly string[];
    };
```

## Responsibilities

### `ProjectionRequest`

`ProjectionRequest` is the only agent-authored input in the model. It is
JSON-serializable and narrow on purpose:

- It can name a known projection with `projectionId`.
- It can declare the target channel.
- It can add stable hints such as intent, locale, and capabilities.

It cannot carry JSX, HTML, callback functions, CSS, DOM references, transport
handles, or arbitrary rendering programs. Agents ask for a known shape. Ignite
and the application decide how that shape is fulfilled.

### `ProjectionContext`

`ProjectionContext` is derived from the existing headless runtime and is
immutable during a selection pass:

- `snapshot` preserves the raw source state.
- `view` preserves the existing derived-state contract.
- `schema` preserves the serialized command and event contract from
  `getSchema()`.
- `canExecute(name)` exposes dynamic availability without making schema itself
  impure.

This keeps selection grounded in the same state that already powers the
component. No projection gets direct DOM access, random input, mutable registry
state, network IO, clock IO, or actor-web topology handles.

### `ProjectionSpec`

`ProjectionSpec` is application-authored and trusted. It defines:

- a stable `id`,
- a target `channel`,
- an optional `priority` with deterministic ordering,
- a pure `supports(...)` predicate,
- and a pure `resolve(...)` function.

`supports(...)` decides whether the spec is eligible for the request and
context. `resolve(...)` returns the final `ProjectionInstance`.

### `ProjectionInstance`

`ProjectionInstance` separates semantic facts from channel output:

- `facts` is the headless contract.
- `output` is the trusted channel-specific result.

For a DOM channel, `output` may be renderable data or native render surface
instructions authored by the application. For a voice or agent channel,
`output` may be structured text payloads. In every case, `facts` remains the
stable cross-channel contract that tests and tools can assert.

## Deterministic registry semantics

Projection selection must be replayable. The accepted rules are:

1. Registry creation validates unique ids and snapshots the spec list.
2. Duplicate ids are configuration errors and fail registry creation.
3. Registration order never determines selection.
4. If `projectionId` is present, it is authoritative.
5. If the id is missing, return `unknown-projection`.
6. If the id exists but the channel or `supports(...)` check fails, return
   `projection-unavailable`.
7. Without an explicit id, filter specs by matching `channel` and pure
   `supports(...)`.
8. Sort eligible specs by `priority` descending and then `id` ascending.
9. Default `priority` is `0`.
10. Select the first spec or return `no-channel-match`.
11. Never silently fall back from an explicit `projectionId`.
12. Never delegate the final selection to an LLM.

The result is a typed no-match fact instead of a runtime exception.

## Typed resolution examples

### Explicit id success

```ts
type ThermostatView = {
  readonly target: number;
  readonly mode: "heat" | "cool" | "off";
  readonly canChangeTarget: boolean;
};

type ThermostatSchema = {
  readonly commands: {
    readonly setTarget: {
      readonly description: string;
      readonly input: { readonly type: "number" };
      readonly gated?: true;
    };
  };
  readonly events: readonly { readonly type: string }[];
  readonly snapshot: unknown;
  readonly view: ThermostatView;
};

type AgentFacts = {
  readonly summary: string;
  readonly commands: readonly string[];
};

type AgentOutput = {
  readonly role: "tool-response";
  readonly text: string;
};

const agentSpec: ProjectionSpec<
  { readonly context: { readonly target: number } },
  ThermostatView,
  ThermostatSchema,
  AgentFacts,
  AgentOutput
> = {
  id: "thermostat.agent.summary",
  channel: "agent",
  priority: 20,
  supports(request, context) {
    return (
      request.intent === "status" &&
      context.canExecute("setTarget") === context.view.canChangeTarget
    );
  },
  resolve(context, request) {
    return {
      projectionId: "thermostat.agent.summary",
      channel: request.channel,
      request,
      facts: {
        summary: `Target ${context.view.target} in ${context.view.mode} mode`,
        commands: Object.keys(context.schema.commands),
      },
      output: {
        role: "tool-response",
        text: `The thermostat is set to ${context.view.target}.`,
      },
    };
  },
};
```

### Explicit id no-match

```ts
const unavailable: ProjectionResolution<
  { readonly summary: string },
  { readonly text: string }
> = {
  ok: false,
  reason: "projection-unavailable",
  request: {
    projectionId: "thermostat.agent.summary",
    channel: "agent",
    intent: "status",
  },
  availableProjectionIds: ["thermostat.agent.summary", "thermostat.dom.card"],
};
```

### Registry-driven channel match

```ts
const matched: ProjectionResolution<
  { readonly summary: string },
  { readonly text: string }
> = {
  ok: true,
  instance: {
    projectionId: "thermostat.agent.summary",
    channel: "agent",
    request: {
      channel: "agent",
      intent: "status",
      locale: "en-US",
    },
    facts: {
      summary: "Target 70 in cool mode",
    },
    output: {
      text: "The thermostat is cooling to 70 degrees.",
    },
  },
};
```

## Safe agent boundary

The safe boundary is strict:

- Agents may submit `ProjectionRequest`.
- Applications author `ProjectionSpec` and trusted `output`.
- Ignite resolves against runtime facts.
- Agents consume returned `facts` and trusted output.

That boundary explicitly rejects raw generated UI code as the default path.
Model-authored JSX or DOM fragments would bypass the component's command,
schema, and accessibility contract, which would collapse determinism and make
verification impossible.

## Ignite and actor-web ownership

| Concern | Ignite owns | actor-web owns |
| --- | --- | --- |
| `view`, `getView()`, `getSchema()`, `execute()`, `canExecute()` | Yes | No |
| Projection request/selection contract | Yes | No |
| Projection registry contents | Application-authored through Ignite-facing docs | No |
| Source lifecycle for distributed actors | No | Yes |
| Topology, transport, supervision, routing | No | Yes |
| Read-model production and command transport | No | Yes |

Ignite is a projection runtime over behavior contracts. actor-web remains the
owner of distributed runtime topology and source execution. Projection selection
may read actor-web-produced snapshots through Ignite, but it must not become a
transport or orchestration layer.

## v3 beta terminology decision

The v3 beta window is the right place to adopt projection vocabulary directly:

- Use `ProjectionRequest`, `ProjectionContext`, `ProjectionSpec`, and
  `ProjectionInstance` in the design.
- Do not add compatibility aliases for these new concepts.
- Do not rename `view`, `getView()`, or `getSchema()`.

This is additive vocabulary over the existing runtime, not a replacement for the
existing headless contract.

## Alternatives considered

| Alternative | Why it was rejected |
| --- | --- |
| Native JSX guidance only | It helps DOM authors but does not give voice, assistive, or agent consumers deterministic selection. |
| Mandatory top-level accessibility callback | It duplicates `view` and command metadata with a second authoring surface. |
| First-party component suite as the primary accessibility story | It expands core ownership into styling, maintenance, and framework-specific ergonomics that do not solve multi-channel selection. |
| Registry plus metadata and native guardrails | Recommended because it keeps selection deterministic, typed, and additive to the existing runtime. |

## What this design does not claim

Projection resolution can prove that a component exposes the facts needed to
support multiple consumers. It cannot prove that rendered browser output meets
accessible-name computation, focus order, live-region timing, or assistive
technology behavior. Those remain rendered-DOM concerns and are covered in
`docs/accessibility-by-default.md`.
