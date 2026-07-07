# Design: Canonical event shape — flat tagged `{ type, ... }`

## Status

Implemented in the v3 beta cutover. **Breaking, agent-facing** → shipped in the
pre-stable v3 window with a changeset and a downstream migration note. Because
this is still beta, there is no read-time `.payload` compatibility accessor.

## Context

Before the cutover, ignite's event surface had accumulated three shapes that
disagreed:

| Surface | Pre-cutover shape |
| --- | --- |
| author — effects | `emit("toggled", { isOn: true })` — positional `(type, ...payload)` (`EmitFromEvents`) |
| author — source | `source.emitEvent({ type: "SHIPMENT_CREATED", shipmentId })` — flat tagged object |
| observe — `on` / `execute().events` / `record()` | `{ type: M.type, payload: M }` envelope (testing.ts:1773); for source emits the payload itself also carries `type`, giving `{ type, payload: { type, … } }` |
| assert — test DSL | `expectEvent("toggled", { isOn: true })` — positional |

So the same logical event is authored, observed, and asserted in three different
shapes, and even the two `emit` paths diverge. In the actor model (and XState v5),
an event/message **is** a flat tagged union member `{ type, ...fields }` — which is
exactly the shape `source.emitEvent` already uses.

## Decision

Adopt **flat tagged `{ type, ...fields }` as the one canonical event shape**, used
identically by author, observe, and assert:

```ts
// author (both effects and source emits unify on the single-object form)
emit({ type: "toggled", isOn: true });

// observe (the agent surface)
register.on("toggled", (event) => event);   // event === { type: "toggled", isOn: true }
result.events;  // [{ type: "toggled", isOn: true }]   — no envelope, no doubled type

// assert
expectEvent({ type: "toggled", isOn: true });
```

- **`emit`** becomes `emit(member: { type, ...fields })` (XState v5 style); the
  positional `(type, payload)` form is removed. One emit shape for effects and
  sources.
- **Observe** (`on`, `execute().events`, `record()` summaries) delivers the member
  directly — drop the `{ type, payload }` envelope and the redundant doubled `type`.
- **`expectEvent`** accepts the member object: `expectEvent({ type, ...fields })`.
- **`getSchema`** describes events as flat `{ type }` descriptors. Runtime field
  metadata remains a separate future enhancement because event payload types are
  type-only today.

## Why flat, not the envelope

- It's the actor-model / XState v5 canonical; matches the existing `source.emitEvent`.
- Author = observe = assert — one shape to learn, and LLM-legible (the same
  vocabulary-coherence argument as `select().whenChanged()` and `expectSnapshot`).
- Removes the redundant `{ type, payload: { type, … } }` nesting.
- The envelope's one virtue — a uniform `.payload` slot for generic agent routing —
  is recoverable without changing the event shape: `getSchema` advertises event
  names as flat `{ type }` descriptors today, agents route on `type`, and
  field-level runtime metadata can be added later because payload fields are
  type-only in the current contract.

## Impact / migration (this is the cost)

The observe shape is the **agent contract**, so flattening is breaking:

- **`.payload` consumers break** — `record()` summaries and downstream goodway map
  `event.payload`. Update them to read fields off the member.
- **`getSchema` event descriptors change** — agents/tools that introspect events see
  the flat shape.
- **`emit` callers change** — effects move from `emit("t", { … })` to
  `emit({ type: "t", … })`; ripples through `EmitFromEvents` typing.
- Ship with a changeset and coordinate the downstream migration.

## Alternatives considered

- **Keep the `{ type, payload }` envelope** — rejected: redundant doubled `type`,
  diverges from the actor model, and its agent-routing virtue is recoverable via
  `getSchema`.
- **Align only `expectEvent`** (leave wire + emit) — rejected: would just create a
  new mismatch (flat assert vs enveloped observe). Consistency has to be system-wide.
- **Keep positional `emit(type, payload)`** — rejected: not uniform with source
  emits or with the member-as-event mental model.

## Implementation notes

- Unify `EmitFromEvents` typing on the single-member form; confirm payload-field
  typing still infers from the `Events` map.
- Update the observe pipeline (adapter `subscribeEvents` bridge → `on` /
  `execute().events` / `record()`), removing the envelope.
- Update `getSchema` event descriptors + the `record()` `.payload` mapping.
- Coordinate the downstream goodway migration.
- Sequence alongside the assertion-surface change (`expectSnapshot`/`expectView` +
  `expectEvent` object form) — same pre-stable vocabulary pass, but track the
  breaking wire change distinctly from the additive assertion work.

## Related

- `docs/effects-change-detection.md` — `select().whenChanged()` (same coherence theme).
- Assertion-surface alignment: `expectSnapshot` + `expectView` (mirror
  `getSnapshot`/`getView`); `expectEvent` adopts the member object as part of this.
