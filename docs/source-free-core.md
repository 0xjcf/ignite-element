# Source-free root core

## Status

Implemented and available in beta.14. Released 3.0.0-beta.11 still
exports `igniteShell`; it does not provide root `igniteCore`. This is an
explicitly approved breaking contract amendment, not a publication receipt.

## Authoring

```tsx
import { igniteCore } from "ignite-element";

const core = igniteCore();

core("app-layout", () => (
  <>
    <style>{":host { display: grid; gap: 1rem; }"}</style>
    <header><slot name="header" /></header>
    <main><slot /></main>
  </>
));
```

Configure `jsx: "react-jsx"` and `jsxImportSource: "ignite-element/jsx"` in
TypeScript. Ordinary page layout can remain HTML; use registration when slots,
encapsulation or repeated composition justify a custom element.

`igniteCore()`, `igniteCore(undefined)` and `igniteCore({})` are equivalent.
Only an empty plain object is accepted as configuration. Supplied string or
symbol keys, including undefined-valued keys, are rejected. Arrays, null,
functions and other invalid shapes are rejected rather than becoming static
components. Source, states, commands, events, effects, cleanup and onConnect
options do not belong to this entrypoint.

The result is only `(tagName, render) => void`. There are no execution, snapshot,
state, observation or disposal methods. No new helper types are needed; use
`ReturnType<typeof igniteCore>` when a registrar type is necessary. The renderer
receives no arguments. Existing JSX supports fragments, slots, styles and DOM
event binding without a hidden source or state-library peer.

Successful content mounts once per instance and remains through moves and
disconnection/reconnection. Failed mounts are reported and retry on the next
connection. Multiple instances and names keep independent DOM. Duplicate
registration remains a no-op; native name validation remains in effect. There
is no attribute-driven rerendering.

## Source-backed views remain separate

Use `igniteCore` from `ignite-element/xstate`, `/redux`, or `/mobx`
when a source drives the view. Those entrypoints retain their existing contracts:

`source → source-native snapshot → derived states → renderer view`

A malformed source never means static composition. The application/source owns
business behavior, environmental capabilities, cancellation, sharing and native
shutdown. Ignite owns its observation handles and rendering responsibilities.
Effects remain queued after source processing without a renderer commit guarantee, synchronous and
void-returning. They do not acquire retained resources or stop sources.
JSX refs, commit callbacks and keyed identity remain accepted pre-stable
architecture, not implemented by this change.

## Breaking migration from igniteShell

Declarative consumers replace their import and named construction with root
`igniteCore`, retaining the renderer and registration name. The runtime export
`igniteShell` and type exports `IgniteShellConfig`, `IgniteShellHost`,
`IgniteShellRegistrar` and `IgniteShellTeardown` are removed, without an alias.

Consumers of `onConnect` and its returned teardown lose that Ignite-managed
lifecycle capability. Do not copy the option into `igniteCore` or move setup into
Ignite effects. Use application-owned presentation integration or an existing
custom element with the appropriate ownership boundary.

That external owner must acquire the widget, read initial derived state (for
example `get('states')`), deliver ongoing updates (`watch()`), release the
observation and resource, and reacquire/read fresh state on reconnect where
needed. Subscription alone does not provide initial rendering. Setup rollback,
exception-safe release, moves and conditional node replacement remain explicit
responsibilities. Bare HTML is not a resource-management solution.

Observation cleanup must not shut down caller-owned sources. The historical
shell example tying `disposeRuntime()` to host disconnection is not current
runtime-ownership or reconstruction guidance. External adoption is unknown:
absence of repository consumers does not establish that nobody uses the hook.
