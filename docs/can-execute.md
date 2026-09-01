# Design: `canExecute(name)` — command availability for headless/agent gating

## Status

Shipped. **Additive**, non-breaking — ships as a `3.x` minor. Tracked in
`docs/v3-api-consistency.md` (additive gap) and the agent-runtime thread in
`docs/v3-stable-roadmap.md`. Task `1781798486122`.

## Context

The headless runtime can `execute({ command, input })` a command, but a driver — an LLM
agent, a test, an external imperative host — has no way to ask **"is this command
callable right now?"** before trying it. Two consumers need that:

- **Agents / `igniteTools`** — offer only currently-valid tools (dynamic tool
  availability). Without it the LLM is offered a `submit` the machine would ignore,
  wasting a turn.
- **External imperative hosts** — e.g. a React app holding a ref to the element,
  disabling a control.

A component's **own** UI does *not* use this — it derives `disabled` from the
destructured renderer args, source-native (`snapshot.can(...)` for xstate,
`snapshot.matches(...)`, …). `canExecute` is the **headless/agent surface** (see the
two-surface rule below).

The original brief said "backed by the same info `getSchema()` exposes" — that's the
contradiction this design resolves: `getSchema()` is JSON (`toSchemaValue` strips
functions), so it can carry command *input schemas* but not a runtime availability
*predicate*.

## Decision

Add an optional per-command **`canExecute({ snapshot })` predicate**, co-located with
the command via the existing `command(fn, metadata)` helper, evaluated on demand by
`runtime.canExecute(name)`.

```ts
commands: ({ actor }) => ({
  submit: command(
    () => actor.send({ type: "SUBMIT" }),                          // write — uses actor
    { canExecute: ({ snapshot }) => snapshot.can({ type: "SUBMIT" }) }, // read — injected read-model snapshot
  ),
});

runtime.canExecute("submit"); // boolean — evaluates the predicate; default true if absent
```

### One word across the three surfaces

The runtime already has `execute({ command, input })`, so its guard-sibling is `canExecute`
(the classic command-pattern pairing — cf. WPF `ICommand.Execute`/`CanExecute`). Per the
epic's "same concept → same word across author / observe / assert", the *same* word is
used on all three:

```ts
command(fn, { canExecute: ({ snapshot }) => … }) // author — define the rule
runtime.canExecute("submit")                     // observe — run it
expect(scenario.canExecute("submit")).toBe(true) // assert — read it, native matcher
```

(Definition vs. invocation: the author writes the *rule* `({snapshot}) => boolean`, the
consumer asks the *question* `(name) => boolean` — same word, two roles.)

### Mechanics

- **Co-located, off-schema for free.** `canExecute` is a new optional field on
  `CommandMetadata` (a function). `getSchema()` already runs command metadata through
  `toSchemaValue`, which strips functions, so the predicate never leaks into the schema
  JSON. No new storage — it rides the existing `commandMetadataSymbol`.
- **`runtime.canExecute(name): boolean`.** Reads the command's predicate off the metadata
  symbol and evaluates it. Default `true` (no predicate ⇒ always available). Unknown name
  throws, consistent with `execute`.
- **`getSchema().commands[name].gated: true`.** Since availability is dynamic, the static
  schema can't say *whether* a command is available, only *that* it's conditional. The
  build sets `gated: true` when a `canExecute` predicate is present, so an agent knows
  "query `canExecute` for this one" and `igniteTools` can skip the call for ungated
  commands. (`gated` is the one deliberately-different term — it's a static meta-fact
  about the gate, not the gate; the schema can't hold the dynamic value.)
- **Read-model snapshot, not the write-side actor.** The predicate receives a
  `{ snapshot }` context — the runtime injects the **read-model**
  snapshot (`adapter.getSnapshot()`). This matters for actor-web's read/write split: the
  command `actor` is the *command source* (write side), so `actor.getSnapshot()` is the
  wrong source for availability (`transport`/`context` live on the read model). For
  xstate they coincide; for actor-web they don't. As a bonus, the predicate stays a pure
  `snapshot → boolean` (functional-core-clean, trivially testable).
- **Snapshot-only.** No payload. *Availability* ("should this tool be offered?") and
  *call-validity* ("are these specific args valid?") are different layers: availability
  gates the manifest; arg-validity is an `execute`-time concern (reject) or an
  input-schema constraint. A `canExecute(name, payload)` overload can be added later if a
  real arg-dependent case appears.

### Uniform `{ snapshot }` command metadata

The `canExecute` arg is uniformly `{ snapshot }` on every adapter. This differs
intentionally from the projection callback, which is `states(snapshot)`. Only the
snapshot's *internal* shape differs (that's the state model, inherent):

```ts
canExecute: ({ snapshot }) => snapshot.can({ type: "SUBMIT" })          // xstate    — the xstate snapshot
canExecute: ({ snapshot }) => snapshot.cart.items.length > 0            // redux     — the state tree
canExecute: ({ snapshot }) => snapshot.isValid && !snapshot.submitting  // mobx      — the store
canExecute: ({ snapshot }) => snapshot.transport.state === "connected"  // actor-web — extended state + transport
```

The callbacks keep ownership-specific shapes: `states(snapshot)` derives public
states, while `effects({ snapshot, prevSnapshot, emit })` and
`canExecute({ snapshot })` receive metadata contexts.

### Reactivity

`canExecute` is a point query; there is no `watchCanExecute` primitive. Reactivity is
free: derive a parallel availability field in `states` or observe the source with `watchSnapshot` /
`watchStates`) and it re-evaluates on every snapshot change. An agent re-derives the
manifest per turn.

### Two-surface rule

`canExecute` / `execute` / `getStates` / `getSchema` / `igniteTools` are the
**headless/agent surface**. A component's own UI authors from the destructured callback
args: availability projected through `states` and behavior exposed through commands. It must NOT reach for
`component.canExecute(...)` / `.execute(...)`. For an xstate component the button's
`disabled` comes from a projected states field derived with `snapshot.can(E)`; the command's
`canExecute: ({snapshot}) => snapshot.can(E)` is the parallel predicate for the agent
surface. Both are thin reads of the authoritative machine.

## Test DSL — no bespoke assertion

**No `expectCanExecute` helper.** The DSL's `expect*` methods earn their place only where
they add matching power over the host runner — `expectSnapshot`/`expectStates` do
partial-object + predicate matching, `expectEvent(s)` collect events emitted during a
step. `canExecute` returns a plain boolean, which the native matcher covers completely.
So the scenario exposes `canExecute(name): boolean` (mirroring the runtime) and you assert
it natively:

```ts
await scenario.when({ command: "build" });
expect(scenario.canExecute("deploy")).toBe(true);
expect(scenario.canExecute("promote")).toBe(false);
```

The line: chainable `expect*` for match-heavy reads; plain value reads (`canExecute`) +
the runner's matchers for scalars.

## Alternatives considered

- **`available` for the predicate field** — rejected: a synonym that appears only on the
  author side breaks "same word across surfaces". The query must be `canExecute` (pairs
  with `execute`), so the predicate and the test read are `canExecute` too.
- **`expectCanExecute(name, bool)` bespoke assertion** — rejected: adds DSL surface for a
  scalar the native matcher already covers.
- **Separate `availability: { name: predicate }` config map** — rejected: a second place
  to look; co-locating on the command keeps the guard with what it guards.
- **(ii) Auto-derive** — commands declare the event they send, so `canExecute` computes
  `snapshot.can(event)` with no predicate. Nicer for the trivial xstate single-event
  command, but it's a new command-authoring model and degrades to (i) the moment a command
  has logic or isn't xstate. **Deferred** as possible future sugar layered on (i).
- **Backed by `getSchema` metadata** — rejected: schema is JSON; a predicate can't live
  there (the original brief's contradiction).
- **`watchCanExecute` reactive primitive** — rejected: redundant with calling
  `canExecute` alongside the existing states/watch surface.

## Impact

Additive. New: `CommandMetadata.canExecute?`, `runtime.canExecute`, scenario
`canExecute`, `getSchema` `gated`. No behavior change for existing components (no
predicate ⇒ always available). Files: `packages/ignite-core` (`CommandMetadata`),
`runtime/agent.ts` (`canExecute` + `gated` in `getSchema`), `types/agent.ts`
(`IgniteAgentRuntime`), `testing.ts` (scenario `canExecute`), tests, docs, and a
minor changeset.

## Related

- `docs/ignite-tools.md` — the primary consumer (dynamic tool availability).
- `docs/v3-api-consistency.md`, `docs/v3-stable-roadmap.md` (agent-runtime thread).
- Memory: `v3-api-consistency-epic`, `expose-source-native-api`.
