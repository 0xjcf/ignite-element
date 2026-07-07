# Design: Effects change-detection — `select().whenChanged()`

## Status

**Rejected (2026-06-20, owner).** Not implementing. `whenChanged` is marginal sugar
over the existing `.changed` field — it only covers the single-selection case
(combined conditions still need `.changed`/`.current`) and adds a second
change-gating idiom on a surface being narrowed for stable + LLM legibility. The
bundled `Object.is`→structural-equality default is a behavior change with low payoff
when effects gate on a scalar (the recommended practice). If an object-selection
footgun ever bites, add the purely-additive `isEqual` arg + `shallowEqual` helper
then (no default flip). The 2026-06-18 design discussion is preserved below.

## Context

`igniteCore` effects run the consequence layer: a callback invoked once per state
**transition** (subscribe → microtask after a state update), in both the DOM host
and the headless/agent runtime (shared `attachEffects` in
`packages/ignite-element/src/runtime/effects.ts`). The dominant idiom is
**emit-on-transition** — derive a value, and only act when it changed:

```ts
effects: ({ select, emit }) => {
  const isOn = select((s) => s.matches("on"));
  if (!isOn.changed) return;            // the ceremony
  emit({ type: "toggled", isOn: isOn.current });
};
```

Today `select(fn)` returns `{ current, previous, changed }` with
`changed = !Object.is(current, previous)`. Two problems:

1. **Ceremony.** The guard-and-early-return (`if (!x.changed) return;`) is repeated
   boilerplate, and `.current` access adds noise. `select`'s whole reason to exist
   over a plain `fn(snapshot)` is the change-tracking, so the change path should be
   first-class.
2. **Object-selection footgun.** `Object.is` is reference equality. Selecting an
   object (`select((s) => s.context.params)`) compares fresh references each
   transition → `changed` is almost always `true` → spurious emits. MobX's `toJS`
   clones make this guaranteed.

## Decision

Two additive changes to `select` (no breaking change to existing fields):

1. **Chainable `whenChanged(run)`** — runs `run(current, previous)` only when the
   value changed, deleting the guard:

   ```ts
   effects: ({ select, emit }) => {
     select((s) => s.matches("on")).whenChanged((isOn) =>
       emit({ type: "toggled", isOn }),
     );
   };
   ```

2. **Default equality = structural value-equality with an `Object.is` fast path**,
   so object selections keep the same single-arg shape (no comparator required):

   ```ts
   select((s) => s.context.params).whenChanged((params) =>
     emit({ type: "paramsChanged", params }),
   );
   ```

   An optional `isEqual` override remains for exotic values (Date/Map/class
   instances) or performance-sensitive large selections.

The raw `current` / `previous` / `changed` fields stay, for combined conditions a
single callback can't express:

```ts
effects: ({ select, emit }) => {
  const route = select((s) => s.context.route);
  const authed = select((s) => s.context.authed);
  if (route.changed && authed.current) {
    emit({ type: "enteredAuthedRoute", route: route.current });
  }
};
```

### Result type

```ts
type Selected<V> = {
  current: V;
  previous: V;
  changed: boolean;
  /** Runs `run` only when the selected value changed this transition. Pure — no I/O. */
  whenChanged(run: (current: V, previous: V) => void): Selected<V>;
};
```

### Equality

```ts
// changed = isEqual ? !isEqual(current, previous) : !valueEqual(current, previous)
function valueEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;                 // primitives + same ref → O(1)
  if (typeof a !== "object" || a === null ||
      typeof b !== "object" || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) &&
      a.length === b.length && a.every((v, i) => valueEqual(v, b[i]));
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length &&
    ka.every((k) => valueEqual((a as Record<string, unknown>)[k],
                               (b as Record<string, unknown>)[k]));
}
```

`valueEqual` is pure (deterministic → safe for agent replay) and mirrors the
structural-dedup approach `ActorWebAdapter` already uses.

## Vocabulary rationale — why `whenChanged`, not `when`

`when` reads nicely but is the weakest name on the two axes ignite optimizes for:

- **Actor model.** In Erlang/Elixir `when` is the **guard** keyword (a value
  predicate); XState calls the same thing a `guard`. So `select(pred).when(cb)` reads
  as "when [the value condition holds]" — the opposite of "when it changed." The
  actor-native concept here is the **transition**; `changed` is its adapter-agnostic
  name (redux/mobx don't "transition" but they do "change").
- **LLM legibility.** ignite's differentiator is agent/LLM-drivability +
  introspection (`getSchema`), which makes API names a first-class constraint.
  `whenChanged` / `onChange` / `distinctUntilChanged` are well-represented corpus
  patterns for "react to a change"; `.when` for change-detection is not, and invites
  misgeneration as a truthiness guard.

`whenChanged` survives both; the terse `.changed` field still serves anyone who
wants the imperative form.

## Performance

Effects fire per **transition**, not per render/frame — frequency is bounded by
user/agent action rate, so `select` cost is dwarfed by the re-render it accompanies.

| Selection | Equality cost |
| --- | --- |
| Scalar (`matches('on')`, id, flag) | `Object.is` → O(1) |
| Object, same ref (structural sharing) | `Object.is` fast path → O(1) |
| Object, different ref | `valueEqual` → O(selection size), short-circuits on first diff |

The only footgun is selecting the **whole** state (`s => s.context`) → O(state)
walk. Mitigations: select the narrow scalar you gate on (`s => s.context.params.id`,
cheapest), or pass `isEqual` comparing a `version`/`rev` field. Selectors run twice
per transition (current + previous) — keep them cheap and pure. For long headless
agent runs the larger cost is `record()` trace memory, not `select` CPU (separate
concern).

## Headless / agent impact

Purely additive and behavior-neutral for agents. `whenChanged` only changes how an
effect is **authored**; the emitted-event stream is identical to the hand-written
`.changed` guard. Every agent API (`execute`, `on`, `getSnapshot`, `getView`,
`watch*`, `getSchema`, `record`) is unchanged, and effects are not introspected into
`getSchema`, so the schema is unchanged.

## Alternatives considered

- **`.when`** — rejected: collides with actor-model guard semantics + ambiguous to
  LLMs (see vocabulary).
- **Comma-ok / destructure** (`const { current: isOn, changed } = select(...)`) —
  already works today; keeps control flow flat but can't shed the guard line. Kept
  as the imperative style, not the primary ergonomic.
- **Standalone `onChange(selector, cb)` free function** — equivalent power, but adds
  a second top-level concept; chaining off `select` keeps one concept.
- **`selectAll({ a: fn, b: fn })` → per-field `Selected` map** (structured select) —
  deferred. Walking the real effect-block scenarios, it unlocks **no** capability the
  single-value `select` lacks: "react when any of several changed, with all current
  values" is already `select((s) => ({ a, b })).whenChanged(({ a, b }) => …)` once the
  default equality is structural; cross-field conditions already use the raw
  `current`/`previous`/`changed` fields. The remainder is cosmetic grouping, and a
  second selection API adds a "which one?" choice on a surface we are deliberately
  narrowing for stable (and for LLM legibility). Adding it later is non-breaking;
  shipping it unused is a stable-API liability — so gate it on real dogfooding demand.
- **`shallowEqual` as a required comparator for objects** — rejected: breaks the
  single-arg shape and still mis-reports nested-but-equal objects. Structural default
  is correct and needs no caller ceremony.
- **`onTransition` / `onEnter(state)`** — machine-specific; not adapter-agnostic.

## Open questions / next steps

- Wire `whenChanged` + `valueEqual` + optional `isEqual` into `createSelect`
  (`runtime/effects.ts`) and the `Selected`/`EffectSelector` types, behind a FAS task.
- Tests: `whenChanged` fires only on change; object selection no longer spurious;
  `isEqual` override path; scalar fast-path unchanged.
- Export a `shallowEqual` helper for the `isEqual` override convenience.
- Docs: effects-guide note on the cost model + "select narrow slices."
- Optional: a Vitest `bench` (scalar vs small-object vs whole-context) to back the
  guidance with numbers.
- Optional (later): dev-mode diagnostic warning when one `valueEqual` traverses more
  than N nodes (catches "selected the whole state"); zero prod cost.
- Decide whether the structural-default flip needs a changeset note (corrective
  behavior change for object selections; pre-stable, so low risk).
