# Core API and bindings: v3 development candidate

This is the implemented local-candidate contract, not publication or stable-release
acceptance. The flow remains source → native snapshot → derived states → view.

## Construction and reads

Use the public source entrypoint (`ignite-element/xstate`, `/redux`, `/mobx`, or
`/actor-web`). Root `const core = igniteCore()` remains source-free registrar-only.
Source-backed owners retain registration and opaque projection-target call forms.

| Surface | Contract |
| --- | --- |
| `get('states')` | Current inferred derived projection; first read prepares real bindings and owner cache |
| `get('schema')` | Pure immutable minimal catalogue, never source acquisition |
| `get('commands')` | Bound own command names with `{ input: null }`, not functions |
| `get('events')` | Declared names with `{ type, payload: null }`, not history |
| `watch((next, previous) => …)` | Derived observations without initial user delivery or global deep equality |
| `on(name, handler)` | Flat outward occurrences; independently idempotent unsubscribe handle |
| `execute({ command, input })` | One payload argument; awaited callback and paired snapshot/states/window events |
| `dispose()` | Terminal owning cleanup; rejected before teardown after successful registration |

No zero-argument read, snapshot key, path language, function lookup or compatibility
aliases are added. The former public raw getters/watchers, derived getters/watchers,
schema getter, `canExecute`, command helpers and their metadata builders are removed.
Native source APIs, native snapshots in projections/effects/execution, and the
private document/speech observation seam remain.

## Minimal catalogue

```json
{
  "schemaVersion": 1,
  "states": { "schema": null },
  "commands": { "save": { "input": null } },
  "events": [{ "type": "saved", "payload": null }]
}
```

Before a configured command callback binds to its actual runtime, `commands` is
null. With no callback, it is known-empty `{}`. Null schemas mean unknown, not no
input or validated/unrestricted JSON. Declared names do not exhaust native emits.
Previously returned catalogues never mutate; the latest survives disposal.

## Commands and tools

```ts
commands: ({ actor }) => ({
  save: ({ title }: { title: string }) => actor.send({ type: 'SAVE', title }),
}),
```

Guarded ordinary functions preserve receiver, argument tuples, arity-sensitive
setters, exact return/throw values and original promises. They observe the current
source when invoked. Known and dynamic state/command name collisions are rejected;
function-valued states stay states. Retained commands reject after their owner ends.

Serialized execution always passes one argument, including undefined when input is
omitted. Arrays are not spread. Strict types reject commands requiring multiple
positional arguments; their direct signatures remain usable. Execution waits for
the callback and queued observation window, not network/persistence completion or
separately correlated overlapping business receipts. A post-disposal callback
rejection preserves its reason; fulfillment rejects rather than reacquiring state.

Project availability into states and retain source guards. Explicit tool schemas,
descriptions and predicates live in application code. Missing schemas fail before
model execution; do not fabricate empty-object input schemas. See [tools](ignite-tools.md).

## Terminal ownership

Disposal marks ended before release, suppresses queued Ignite delivery, prevents
reentrant acquisition, drains owned handles in acquisition order and attempts native
teardown only where ownership permits. It clears references and rethrows the first
exact cleanup value, including null/undefined. Repeated disposal and individual
handle release are inert. Partial setup rolls back without replacing its primary
exception. Already-entered external work is not cancelled by Ignite.

Borrowed sources are not stopped. A privately Ignite-created XState actor is
stopped once after observation cleanup; an unused core creates none. Redux/MobX
release subscriptions/autoruns, not application shutdown. Headless Actor-Web factories
do not transfer native close authority, even for newly created handles.

Successful registration prevents owning disposal; failed registration does not
permanently lock the core. Existing DOM reconnect behavior remains. Registered
element lifetime is not a new terminal-disable project.

## Framework and platform boundaries

Prepare once with `core.get('states')` in application bootstrap, outside React
rendering. `useIgnite(core)` from `ignite-element/react` borrows inferred states
and stable commands through a shared private capability. Reads are cached and
pure, remain current across subscription gaps, and reconcile render/subscribe
races. Hook unmount does not dispose the core. Prop replacement never retargets
old commands to a new owner.

Framework snapshots detach/freeze nested plain records and arrays without freezing
the source. Project suitable primitives/plain data/functions; arbitrary classes
and accessors are rejected, not serialized. Presentation-owned resources remain
with the framework. Effects keep queued post-Ignite-render timing; they may precede
React commit and are not `useEffect` or a cross-framework commit barrier.

`ignite-element/react/web` retains the custom-element wrapper, typed props/events/
imperative refs and actual per-element command targets. It creates no hidden
headless actor for discovery. Neutral core/hook imports and strict no-DOM consumers
are separate from genuine web-host typing and browser execution.

`ignite-element/actor-web/web` retains the actual `{ host?: HTMLElement }` factory
context. Provisioning occurs per element; all headless acquisition routes reject
before invoking that factory. Its existing per-element factory close is not awaited
backing-runtime shutdown. Neutral `/actor-web` accepts source values and factories
callable without a host context.

Authentic neutral Actor-Web consumption needs the separate local upstream
`@actor-web/runtime/source` correction. The published 0.2.1 root graph does not
become DOM-neutral merely because the local candidate passes. Review and publish
that upstream entrypoint before claiming it available to registry consumers.

The React Native fixture uses the real RN Jest host and standard native-module
mocks, not jsdom or browser stubs. It is not device/simulator evidence. SSR, Solid,
Vue headless bindings, retained JSX resources and source-free runtime expansion
remain outside this candidate.
