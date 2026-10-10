# Command availability after helper retirement

These examples use the current v3 beta contract, including `commands({ source })`.
Install `ignite-element@beta` and the state library for your chosen entrypoint.

The earlier helper-metadata design was superseded in v3 beta.14.
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

Read `core.get('states')`, or observe `core.watch((next, previous) => ...)`.
The first watch delivery is the current projection, with `previous === undefined`.
`{ emitCurrent: false }` observes later transitions only.
Native source snapshots remain on the source,
not a restored public Ignite raw getter.

## Explicit tools

A tool/application boundary can independently supply an availability predicate.
The `canExecute` option name remains valid there; it is not a method on the core.

```ts
import { defineToolSchema, igniteTools } from 'ignite-element/tools';

const schema = defineToolSchema({
  setLimit: {
    description: 'Set the counter limit.',
    input: { type: 'number', minimum: 3, maximum: 12 },
    gated: true,
  },
});
const tools = igniteTools({
  core,
  schema,
  canExecute: name =>
    name === 'setLimit' && core.get('states').canSetLimit,
});
```

The provider list omits commands the predicate does not allow. Invocation
rechecks it with one immutable snapshot of the validated input and `{ core }`.
`run` passes that same snapshot to `execute`. Omit `canExecute` and
commands are denied. Return `true` only for an explicit allow. A throw, a
thenable, or any other result denies the call. `canExecute` is application
preflight, never authentication.

An ungated `read: true` tool skips that gate only when the command is
side-effect-free. `run` still calls `core.execute`. Do not mark a command
`read` if executing it changes source state.

A `consequential` command uses the same predicate. The application compares
the canonical call, the tool name plus the validated input, binds it to the
actor and `context.core`, and consumes the approval id only when
`context.execute` is true. `run` sets that flag after observation setup
succeeds and immediately before `execute`. `resolveCall` does not. A new id
can approve the same call again.
Ignite does not store approval ids or decide replay.
Refresh offered tools when the application needs a fresh availability list.
Source enforcement must still handle state changes after preflight.

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
See [tools](https://0xjcf.github.io/ignite-element/guides/tools/) ([source](ignite-tools.md))
and [core API](core-api-bindings.md).
