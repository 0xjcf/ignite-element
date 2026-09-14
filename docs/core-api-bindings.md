# Core API and bindings: beta.12 and the locked correction

Beta.12 is published. This reference distinguishes that baseline from the locked,
unreleased shared-readiness and terminal-disposal correction. Independent review
and release remain separate decisions. The flow remains source → native
snapshot → derived states → renderer view. See the
[migration contract](site/src/content/docs/migration/shared-readiness-terminal-disposal.mdx).

## Construction and reads

Use the public source entrypoint (`ignite-element/xstate`, `/redux`, `/mobx`, or
`/actor-web`). Root `const core = igniteCore()` remains source-free registrar-only.
Source-backed owners retain registration and opaque projection-target call forms.

| Surface | Contract |
| --- | --- |
| `get('states')` | Current inferred projection; beta.12's first read prepares bindings. The correction prepares shared cores at construction, leaving isolated acquisition explicit |
| `get('schema')` | Pure immutable minimal catalogue, never source acquisition |
| `get('commands')` | Bound own command names with `{ input: null }`, not functions |
| `get('events')` | Declared names with `{ type, payload: null }`, not history |
| `watch((next, previous) => …)` | Derived observations without initial user delivery or global deep equality |
| `on(name, handler)` | Flat outward occurrences; independently idempotent unsubscribe handle |
| `execute({ command, input })` | One payload argument; awaited callback and paired snapshot/states/window events |
| `dispose()` | Terminal owning cleanup; beta.12 rejects it after registration. The correction must end registered views without making tag definitions reusable |

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

Successful registration prevents owning disposal in beta.12. The locked correction
permits terminal registered disposal, with later connections inert, retained
commands rejected and cached catalogues still readable. Failed registration must
not permanently lock a core; registration-in-progress remains guarded. Ordinary
DOM reconnect and explicit shared `cleanup: true` behavior must be preserved.
There is no registration rebinding, replacement overload or new source form.

## Framework and platform boundaries

In beta.12, prepare once with `core.get('states')` in application bootstrap, outside
React rendering. The correction removes this prerequisite for shared sources by
preparing at construction, never during render. `useIgnite(core)` from
`ignite-element/react` borrows inferred states
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

Actor-Web is optional and separate. Neutral consumers must use its supported
source declaration boundary and verify their actual installed graph; importing a
runtime's aggregate root is not a substitute for a no-DOM consumer check. This
task does not reopen the completed beta.12/Actor-Web publication work or grant
Ignite authority over native runtime shutdown.

The React Native fixture uses the real RN Jest host and standard native-module
mocks, not jsdom or browser stubs. It is not device/simulator evidence. SSR, Solid,
Vue headless bindings, retained JSX resources and source-free runtime expansion
remain outside this candidate.
