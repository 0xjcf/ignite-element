# Command availability after helper retirement

> Unreleased command-context change: These examples use `commands({ source })`, which is not available in beta.14. Use this candidate checkout until a supporting beta is published.

The earlier helper-metadata design is superseded in the published v3 beta.14 API.
The public core `canExecute(name)` method, `command(fn, metadata)` helper and
metadata/input-builder exports are removed without aliases.

## Source facts, not a second policy engine

Project meaningful availability into `states`, for example:

```ts
states: snapshot => ({
  canSubmit: snapshot.can({ type: 'SUBMIT' }),
  commandAvailability: { submit: snapshot.can({ type: 'SUBMIT' }) },
}),
commands: ({ source: actor }) => ({
  submit: () => actor.send({ type: 'SUBMIT' }),
}),
```

XState uses its native snapshot capability. Redux/MobX derive application
booleans from their native state.
Do not move guards, admission, authorization or transport authority into Ignite.
Availability is descriptive preflight, never permission or proof of completion.

Read `core.get('states')`, or observe `core.watch((next, previous) => ...)`
without initial user delivery. Native source snapshots remain on the source,
not a restored public Ignite raw getter.

## Explicit tools

A tool/application boundary can independently supply an availability predicate.
The `canExecute` option name remains valid there; it is not a method on the core.

```ts
import { igniteTools } from 'ignite-element/tools';

const schema = {
  commands: {
    setLimit: {
      description: 'Set the counter limit.',
      input: { type: 'number', minimum: 3, maximum: 12 },
      gated: true,
    },
  },
};
const tools = igniteTools(core, undefined, {
  schema,
  canExecute: name =>
    name === 'setLimit' && core.get('states').canSetLimit,
});
```

The provider list omits unavailable explicitly gated commands; invocation
rechecks the predicate. Refresh offered tools when the application needs a fresh
availability list. Source enforcement must still handle state changes after
preflight. Keep invalid-input, unavailable, rejected-source and async/stale-result
tests.

The minimal core catalogue has `{ input: null }` for bound command names and
does not supply schemas or gating rules. Null means unknown, not an empty-object
input contract. Metadata-free automatic tool construction fails when required
schemas are absent.

## Migration

Move existing descriptions and validation definitions to the application's tool
boundary; do not invent schemas for ordinary core authors. Replace public
availability calls with the relevant projected state, not a blanket true value.
Preserve source-native methods and independently supplied policy predicates.

The historical testing/story availability surface remains retired. Use ordinary
assertions over projected states, native source behavior and actual tool results.
See [tools](ignite-tools.md) and [core API](core-api-bindings.md).
