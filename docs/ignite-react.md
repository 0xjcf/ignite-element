# React and React Native bindings

The v3 development candidate separates two integration surfaces. This is local
candidate behavior, not evidence that a new package version is published.

- `ignite-element/react` exports `useIgnite(core)` for headless React or React Native.
- `ignite-element/react/web` exports `igniteReact` and web-wrapper-only types.

## Owner bootstrap

Use the public adapter entrypoint for source-backed construction. Prepare exactly
once outside framework rendering; source-free root construction remains registrar-only.

```tsx
import { configureStore, createSlice } from '@reduxjs/toolkit';
import { igniteCore } from 'ignite-element/redux';
import { useIgnite } from 'ignite-element/react';

const slice = createSlice({
  name: 'counter',
  initialState: { count: 0 },
  reducers: { add: (state, action: { payload: number }) => { state.count += action.payload; } },
});
const source = configureStore({ reducer: slice.reducer });
const core = igniteCore({
  source,
  states: snapshot => ({ count: snapshot.count }),
  commands: ({ actor }) => ({
    add: ({ amount }: { amount: number }) => actor.dispatch(slice.actions.add(amount)),
  }),
});
core.get('states');

export function Counter() {
  const { count, add } = useIgnite(core);
  return <button onClick={() => add({ amount: 2 })}>{count}</button>;
}
```

The application owns the core and calls `core.dispose()` after all borrowed
surfaces end. A hook never disposes the shared core on unmount. An unprepared
core fails clearly before resource acquisition. No new start/prepare helper is
required or provided.

## Snapshot and lifetime contract

The hook uses `useSyncExternalStore` over a package-private shared capability.
Cached reads are pure and referentially stable; the owner cache stays current
across gaps with no React subscribers. Render/subscribe races are reconciled
without preparing from a hook. Strict Mode, multiple consumers and core prop
replacement release only the appropriate observation.

Published snapshots detach and freeze nested plain records/arrays without
freezing caller-owned source values. Project primitives, plain data and functions;
do not expose mutable class instances or accessors. Ignite does not serialize
arbitrary objects. Function-valued states remain states by origin, not commands.

Commands retain stable references, current source behavior, receiver, arity,
arguments, exact return/throw values and original promises. Retained commands
from a replaced core never retarget to its successor; they reject after their
original owner ends. State/command name collisions are rejected rather than
silently overwriting one side.

## Native host

The same hook can feed React Native `View`, `Text` and `Pressable`, with no
browser globals, React DOM, Lit, Solid or Vue dependency. Public packed imports
must share the private binding capability. A fresh no-DOM import, strict
declaration consumption, real source construction and React Native component
integration are separate checks.

The candidate fixture uses React 19.1.0, React Native 0.81.5, React test renderer
19.1.0, Jest 29.7.0 and React Native's standard Jest preset. Native-module mocks
are that test host's supported mocks, not a DOM emulation or Ignite polyfill.
Device/simulator behavior is not established by this evidence. SSR and hydration
are later work; no server-snapshot fallback is supplied.

## Web custom-element wrapper

Registration returns a typed component handle. Keep that handle in the
framework-neutral registration module and wrap it in a separate React module:

```tsx
import { igniteReact, type IgniteReactRef } from 'ignite-element/react/web';
import { useRef } from 'react';
import { Counter as CounterElement } from './counter.ignite';

const Counter = igniteReact(CounterElement);
export function App() {
  const ref = useRef<IgniteReactRef<typeof CounterElement>>(null);
  return <>
    <Counter ref={ref} label="Visitors" onCountChanged={event => console.log(event.count)} />
    <button onClick={() => ref.current?.increment()}>Increment</button>
  </>;
}
```

The component handle provides `tagName` and discovery-only keyed reads.
Ordinary command signatures drive the ref's types; single-argument `setX`
commands retain attribute/prop behavior. Events become `on<Event>` callback
props receiving the existing flat DOM detail. Other props retain normal
attribute/property passthrough.

At runtime the wrapper binds commands from the actual element. It does not
create or target a hidden headless actor to discover methods. Isolated
machine-backed instances retain their own actors. Unknown command discovery
remains different from a known empty catalogue. A successfully registered core
cannot be disposed as an unregistered owner; element reconnect behavior remains
unchanged.

Plain HTML, Vue and Svelte consumers can continue using native element methods,
attributes and events. New Vue/Solid headless bindings are not implemented here.

## Effects and presentation

Ignite effects remain synchronous outward-fact callbacks in a queued microtask
after the corresponding Ignite renderer update. Headless observations can precede
a framework commit. They are not React `useEffect` equivalents and do not own
environmental I/O, presentation resources, source commands or shutdown.
React/native presentation resources follow their framework lifecycle.

For Actor-Web, use the neutral `ignite-element/actor-web` entrypoint for source
values and no-host factories. Host-dependent construction belongs to
`ignite-element/actor-web/web`, cannot be prepared headlessly, and retains the
real optional HTMLElement host type and per-element lifecycle.

See [core API and bindings](core-api-bindings.md), [tools](ignite-tools.md), and
the [host integration guide](site/src/content/docs/guides/host-app-integration.mdx).
