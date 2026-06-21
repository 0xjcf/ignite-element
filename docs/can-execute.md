# Design: `canExecute(name)` — command availability for headless/agent gating

## Status

Proposed (design ✓). **Additive**, non-breaking — ships as a `3.x` minor. Tracked in
`docs/v3-api-consistency.md` (additive gap) and the agent-runtime thread in
`docs/v3-stable-roadmap.md`. Task `1781798486122`.

## Context

The headless runtime can `execute(name, payload)` a command, but a driver — an LLM
agent, a test, an external imperative host — has no way to ask **"is this command
callable right now?"** before trying it. Two consumers need that:

- **Agents / `igniteTools`** — offer only currently-valid tools (dynamic tool
  availability). Without it the LLM is offered a `submit` the machine would ignore,
  wasting a turn.
- **External imperative hosts** — e.g. a React app holding a ref to the element,
  disabling a control.

A component's **own** UI does *not* use this — it derives `disabled` from the
destructured view args, source-native (`snapshot.can(...)` for xstate,
`snapshot.matches(...)`, …). `canExecute` is the **headless/agent surface** (see the
two-surface rule below).

The original brief said "backed by the same info `getSchema()` exposes" — that's the
contradiction this design resolves: `getSchema()` is JSON (`toSchemaValue` strips
functions), so it can carry command *input schemas* but not a runtime availability
*predicate*.

## Decision

Add an optional per-command **`available(snapshot)` predicate**, co-located with the
command via the existing `command(fn, metadata)` helper, evaluated on demand by
`runtime.canExecute(name)`.

```ts
commands: ({ actor }) => ({
  submit: command(
    () => actor.send({ type: "SUBMIT" }),
    { available: (snapshot) => snapshot.can({ type: "SUBMIT" }) }, // xstate-native
  ),
});

runtime.canExecute("submit"); // boolean — available(getSnapshot()); default true if no predicate
```

- **Co-located, off-schema for free.** `available` is a new optional field on
  `CommandMetadata` (a function). `getSchema()` already runs command metadata through
  `toSchemaValue`, which strips functions, so the predicate never leaks into the
  schema JSON. No new storage mechanism — it rides the existing `commandMetadataSymbol`.
- **`getSchema().commands[name].gated: true`.** Since availability is dynamic, the
  static schema can't say *whether* a command is available, only *that* it's
  conditional. The build sets `gated: true` when `available` is present, so an agent
  knows "query `canExecute` for this one" and `igniteTools` can skip the call for
  ungated commands.
- **`runtime.canExecute(name): boolean`.** Reads the command's `available` off the
  metadata symbol and evaluates it against `getSnapshot()`. Default `true` (ungated).
  Unknown name throws, consistent with `execute`.
- **Snapshot-only.** `available(snapshot)`, no payload. *Availability* ("should this
  tool be offered?") and *call-validity* ("are these specific args valid?") are
  different layers: availability gates the manifest; arg-validity is an `execute`-time
  concern (reject) or an input-schema constraint. A `canExecute(name, payload)`
  overload can be added later if a real arg-dependent-availability case appears.
- **Source-native predicates.** The predicate sees the full snapshot, so each adapter
  taps its native availability:
  - xstate — `available: (s) => s.can({ type: "SUBMIT" })` — machine-accurate
    enablement, the same source the component's view uses for `disabled`.
  - actor-web — `available: (s) => s.transport.state === "connected" && s.context.valid`
    — connection-aware gating (don't offer tools when the remote actor is unreachable).
  - redux / mobx — `available: (s) => s.valid && !s.submitting` — plain predicate.

### Reactivity

`canExecute` is a point query; there is no `watchCanExecute` primitive. Reactivity is
free: call it inside the existing reactive surfaces (`view` / `watchSnapshot` /
`watchView`) and it re-evaluates on every snapshot change. An agent re-derives the
manifest per turn.

### Two-surface rule

`canExecute` / `execute` / `getView` / `getSchema` / `igniteTools` are the
**headless/agent surface**. A component's own UI authors from the destructured callback
args, source-native (`snapshot.can`, `actor.send` via commands) — it must NOT reach for
`component.canExecute(...)` / `.execute(...)`. For an xstate component the button's
`disabled` comes from `snapshot.can(E)` in the view; the command's
`available: s => s.can(E)` is the parallel predicate for the agent surface. Both are
thin reads of the authoritative machine.

## Test DSL companion

Add `expectCanExecute(name, boolean)` mirroring `expectState`/`expectView`, so a
scenario can assert availability — the nested-router+auth dogfood: "`goAdmin`
unavailable until `authed`." Additive, ships with the same change.

## Alternatives considered

- **Separate `availability: { name: predicate }` config map** — rejected: a second
  place to look; co-locating on the command keeps the guard with what it guards.
- **(ii) Auto-derive** — commands declare the event they send, so `canExecute` computes
  `snapshot.can(event)` with no predicate. Nicer for the trivial xstate single-event
  command, but it's a new command-authoring model and degrades to (i) the moment a
  command has logic or isn't xstate. **Deferred** as possible future sugar layered on
  (i).
- **Backed by `getSchema` metadata** — rejected: schema is JSON; a predicate can't live
  there (the original brief's contradiction).
- **`watchCanExecute` reactive primitive** — rejected: redundant with calling
  `canExecute` inside the existing view/watch.

## Impact

Additive. New: `CommandMetadata.available?`, `runtime.canExecute`, `getSchema` `gated`,
`expectCanExecute`. No behavior change for existing components (no `available` ⇒ always
available). Likely files: `packages/ignite-core` (`CommandMetadata`), `runtime/agent.ts`
(`canExecute` + `gated` in `getSchema`), `types/agent.ts` (`IgniteAgentRuntime`),
`testing.ts` (`expectCanExecute`), tests, docs. Ship with a changeset (minor).

## Related

- `docs/ignite-tools.md` — the primary consumer (dynamic tool availability).
- `docs/v3-api-consistency.md`, `docs/v3-stable-roadmap.md` (agent-runtime thread).
- Memory: `v3-api-consistency-epic`, `expose-source-native-api`.
