# Design: states projection canonicalization

## Status

Implemented for the v3 beta contract. **Breaking.**

## Decision

`states` is the only `igniteCore` projection configuration field. It receives
the adapter's bare native snapshot and returns a plain object:

```ts
const counter = igniteCore({
  source,
  states: (snapshot) => ({
    count: snapshot.context.count,
    active: snapshot.matches("active"),
  }),
});
```

The callback does not receive `{ snapshot }`, and config `view` is rejected.
`view` remains valid terminology for the renderer supplied when registering a
component.

Native snapshot shapes remain adapter-specific:

- XState exposes `StateFrom<Machine>`, including `snapshot.context` and
  `snapshot.matches(...)`.
- Redux and MobX expose their supported store observations directly.
- Actor-Web exposes its existing supported snapshot, including its current
  context and transport facts.

Omitting `states` means no derived states. `getStates()` returns one stable empty
object; raw snapshot fields are not copied into it.

## Migration

```ts
// beta.10
view: ({ snapshot }) => ({ route: snapshot.context.route })

// next beta
states: (snapshot) => ({ route: snapshot.context.route })
```

Also migrate:

- `getView()` / `watchView()` to `getStates()` / `watchStates()`;
- `schema.view` to `schema.states`;
- story `view` / `finalView` fields to `states` / `finalStates`;
- tool and execution observations to `{ snapshot, states, events }`;
- XState flattened `ExtendedState` annotations to `StateFrom<Machine>`;
- public renderer access to raw `state` / `send` to derived states and semantic
  commands.

## Coherence

Each inspection resolves one snapshot and derives states exactly once from that
same value. `execute()`, schemas, stories, tools, subscriptions, and renders use
that paired observation instead of rereading the source between fields.
