# Design index: v3 API vocabulary & shape consistency

## Status

Active tracking doc (pre-stable v3). Indexes the sub-decisions for a coherent
vocabulary + shape pass across the public surface.

## Why

ignite's differentiators are dev DX **and** agent/LLM-drivability (`getSchema`,
headless `execute`). Both depend on **one** canonical vocabulary and shape repeated
across the three surfaces a consumer or agent touches:

- **author** — `igniteCore` callbacks (`view` / `commands` / `effects` / `events`)
- **observe** — runtime: `getSnapshot` / `getView` / `on` / `execute().events` / `record` / `getSchema`
- **assert** — the test DSL (`given` / `when` / `expect*`)

Those surfaces have drifted. This pass realigns them while we are pre-stable and can
still make breaking changes cheaply.

## Principle

Same concept → same word → same shape, on author / observe / assert. Prefer the
actor-model / XState-v5 canonical where one exists. Keep adapter-native escape
hatches (no state-lib lock-in), but make the *ignite* surface uniform.

## Sub-decisions

| Decision | Doc | Kind | Status |
| --- | --- | --- | --- |
| ~~`select().whenChanged()` + structural-equality default~~ | `effects-change-detection.md` | additive | **dropped (2026-06-20)** — marginal sugar over `.changed`; see doc |
| Flat tagged event `{ type, … }` (emit / observe / `expectEvent`) | `event-shape.md` | **breaking** | design ✓, task queued (1781818971210) |
| Uniform view/effects context = `{ snapshot }` (drop the spread) | `view-context-canonicalization.md` | **breaking** | design ✓, task queued (1781818972687) |
| Effects single (object) signature; remove positional for v3 beta | this doc | beta breaking | shipped in this epic (1781818975642) |
| `expectView` (add) + **full `state`→`snapshot` rename** (`expectState`→`expectSnapshot` + `result.snapshot`/`schema.snapshot`/record-trace) + `expectEvent` object form | `event-shape.md` + this doc | mixed | `expectView` shipped; rename task queued (1781818974159) — scope = full rename (b), resolved 2026-06-20 |
| Test host seam: fluent `.host({ dataset, attributes })` | `task-1781619012619` | additive | task (refine brief to fluent shape) |
| `canExecute(name)` command-availability query | `can-execute.md` | additive (gap) | shipped (1781798486122) |
| `igniteShell` sourceless composition root (+ shared move-safe teardown) | `ignite-shell.md` | additive (gap) | design ✓ |
| `ignite-element/react` schema-driven wrapper + registration handle | `ignite-react.md` | additive (gap) | design ✓, task reshaped (1781805261094) |
| `getSchema().view` — expose the typed view projection in the schema | this doc | additive (gap) | task queued 2026-06-21 (needs typed-view) |
| `igniteTools(component)` — getSchema → LLM tool-use bridge (agent analog of `igniteReact`) | `ignite-tools.md` | additive (gap) | design ✓, task queued 2026-06-21 |

## Intentional — document, do not "fix"

- **Command `actor` is adapter-native** (`send` / `dispatch` / store methods /
  actor-web `send`/`ask`). Deliberate — "use your state lib natively." The only lever
  is an *optional* unified `send(event)` helper layered on top (previously deferred
  spike). OPEN product decision.
- **actor-web read/write split** — actor-web's model supports separate read and
  command handles, but Ignite no longer exposes a separate `commandSource` config key
  (removed beta.8 for a unified one-source surface — every adapter takes one `source`;
  the command actor derives from it, writable iff it exposes `send`). A source can
  still bundle reads + writes internally.

## Sequencing

- **Additive** (`expectView`, host seam, `canExecute`): ship independently,
  anytime.
- **Breaking** (event shape, view-context `{ snapshot }`, full `state`→`snapshot`
  rename): land **together** in one pre-stable cutover, one coordinated changeset,
  one goodway migration note. Tracked here so they cut over once.

**Cutover scope reality (all three).** The breaking landing is not just `src`: the
doc code-example guardrail (`check-doc-examples.mjs`) typechecks every `ts`/`tsx`
fence against the real API, so **every `docs/site` example** using `emit`, the view
context, or `expectSnapshot`/`result.snapshot` must migrate in the *same* change or the
guardrail fails. Budget the cutover as **src + docs-site sweep + the three design
docs + one goodway migration note**. The beta-breaking **effects object-form**
(`1781818975642`) has already removed positional callbacks so the effects callback
changes once, cleanly, before the emit-shape break. One consolidated migration table
covers all transforms: `emit(t,p)` →
`emit({type:t,…})`; `event.payload` → direct member fields; `{ context }` → `{ snapshot }` +
`snapshot.*`; `expectSnapshot`/`result.snapshot`/`schema.snapshot` → `…snapshot`;
`expectEvent(t,p)` → `expectEvent({type:t,…})`.

## Decisions (resolved 2026-06-18)

1. **Command-actor: leave adapter-native.** Resolved — `getSnapshot()` shipped on
   the XState command actor (the one invented accessor, `.state`, was removed); an
   optional unified `send()` remains a separate deferred spike, not a stable
   blocker. See `expose-source-native-api`.
2. **view-context: `{ snapshot }`-only** (no convenience alias). Tasked:
   `1781818972687`.
3. **`state` → `snapshot`: full rename, everywhere the value is named (resolved
   2026-06-20 — chose the complete rename (b), not method-only (a)).** The value
   `getSnapshot()` returns is a *snapshot*, not a state-machine "state": per adapter
   it's the xstate snapshot (`ExtendedState` = `StateFrom & context`; the FSM state
   is only `snapshot.value`), the redux state tree, the mobx store, or the actor-web
   extended state. "state" is the native word for **redux only**, ambiguous for
   xstate (collides with `snapshot.value`) and foreign to mobx. "snapshot" is the
   honest *uniform* word — it *contains* the FSM state rather than colliding with it,
   and it matches the instrument ignite already chose (`getSnapshot`/`watchSnapshot`,
   mirroring XState v5's own `service.state` → `actor.getSnapshot()` correction). So
   rename the value on **every** surface, not just the assertion:
   - **assert** — `expectState` → `expectSnapshot`; type `IgniteStateExpectation`
     → `IgniteSnapshotExpectation`.
   - **observe / result** — `execute().state` → `execute().snapshot`
     (`IgniteAgentExecutionResult`).
   - **observe / schema** — `getSchema().state` → `getSchema().snapshot`
     (`IgniteAgentSchema`).
   - **observe / record + story** (agent-facing replay) — trace `kind: "state"` →
     `"snapshot"`, `IgniteStoryStateTraceEntry.state` →
     `IgniteStorySnapshotTraceEntry.snapshot`, `IgniteStorySummary.finalState` and
     serialized `IgniteStorySummarySnapshot.finalState` → `finalSnapshot`. *This
     changes serialized trace output — trace snapshot tests migrate with it.*
   - `expectEvent` adopts the flat member object (coordinated with `event-shape.md`).
   - **v3 beta hard cut:** no delegating `expectState` alias, no `state` getter beside
     `snapshot` on the execute result, no schema `state` mirror, and no story
     `finalState`/trace `state` compatibility. Tasked: `1781818974159` (scope
     expanded to the full rename).

The breaking trio (event shape / view-context / rename) is wired to **block the
main-merge**, which blocks the stable cut — see `docs/v3-stable-roadmap.md`.

## Related

- `docs/v3-stable-roadmap.md` — the phased plan + dependency spine to stable.
- `docs/effects-change-detection.md`, `docs/event-shape.md`,
  `docs/view-context-canonicalization.md`, `docs/ignite-shell.md`
- Memory: `v3-api-consistency-epic`, `ignite-monorepo-dual-state-lib-skew`,
  `expose-source-native-api`
