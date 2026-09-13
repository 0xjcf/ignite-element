# ignite-element

Default public package for building platform-native custom elements with explicit intent, derived states, deterministic effects, and DOM-native events.

> **v3 is in beta.** Install with `@beta` — the stable `latest` tag is still
> v2.2.x. The state libraries are optional peer dependencies, so only the one
> you install is pulled in. v3 is native ESM-only and does not advertise a
> CommonJS `main` or `require` contract.

Most users should install `ignite-element` and one state library:

- XState: `npm install ignite-element@beta xstate`
- Redux: `npm install ignite-element@beta @reduxjs/toolkit`
- MobX: `npm install ignite-element@beta mobx`

Actor-Web integration is optional. Use `ignite-element/actor-web` only when an
Actor-Web runtime owns orchestration and source lifecycles for the host app.
Standalone Ignite components do not require Actor-Web.

If you use the built-in JSX runtime, enable Ignite JSX in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "ignite-element/jsx"
  }
}
```

The config-free path is the default: import adapters from `ignite-element/xstate`
or the matching state-library entrypoint, point `jsxImportSource` at
`ignite-element/jsx`, and render local styles with ordinary `<style>` tags.
Reach for `ignite.config.ts` only when you need advanced shared shadow-root
styles, diagnostics, or legacy compatibility wiring.

Quick start:

```tsx
import { createMachine } from "xstate";
import { igniteCore } from "ignite-element/xstate";

const styles = `
  button {
    border-radius: 999px;
    padding: 0.65rem 1rem;
  }
`;

const machine = createMachine({
  initial: "off",
  states: {
    off: { on: { TOGGLE: "on" } },
    on: { on: { TOGGLE: "off" } },
  },
});

const toggle = igniteCore({
  source: machine,
  events: (event) => ({
    toggled: event<{ isOn: boolean }>(),
  }),
  states: (snapshot) => ({
    isOn: snapshot.matches("on"),
  }),
  commands: ({ actor }) => ({
    toggle: () => actor.send({ type: "TOGGLE" }),
  }),
  effects: ({ emit, select }) => {
    const isOn = select((snapshot) => snapshot.matches("on"));
    if (!isOn.changed) return;
    emit({ type: "toggled", isOn: isOn.current });
  },
});

toggle("toggle-button", ({ isOn, toggle }) => (
  <>
    <style>{styles}</style>
    <button onClick={toggle}>{isOn ? "On" : "Off"}</button>
  </>
));
```

The resulting element can be consumed anywhere the browser can render a custom element, including plain HTML and host frameworks like React or Vue.

## Choosing an adapter entrypoint

### Source-free layouts (unpublished review candidate)

The candidate replaces root `igniteShell` with `igniteCore()` and retires the four
shell-specific types. `onConnect` and returned teardown are removed, not silently
accepted. Released beta.11 does not have this root constructor.

```tsx
import { igniteCore } from "ignite-element";

const core = igniteCore();
core("app-layout", () => <main><slot /></main>);
```

No source or state-library peer is needed. Omitted configuration, undefined and
an empty plain object are equivalent; options are rejected. The renderer has no
source arguments. The registrar has no behavior/runtime/disposal methods, and
successful DOM is retained across moves and reconnection.

Hook consumers must use application-owned presentation integration or an existing
custom element, including initial state, updates and cleanup. This does not move
resource ownership or source shutdown into effects. External usage is unknown.
The repository's `docs/source-free-core.md` records the full breaking migration.

### Source-backed entrypoints

Use `ignite-element/xstate` when XState owns the source behavior. The application
owns source construction and lifetime; Ignite observes snapshots, projects states,
coordinates rendering and cleans up its own observation handles.

Use `ignite-element/actor-web` when an Actor-Web runtime already owns orchestration, transport, sequencing, and source lifecycle. In that mode Ignite stays projection-first: it consumes Actor-Web snapshots, derives states, and sends explicit requests back with `actor.send(...)` or `actor.ask(...)`. `actor.ask` is optional and only exists on sources that support request/response.

```ts
import { igniteCore } from "ignite-element/actor-web";

const shipmentCard = igniteCore({
  source: ({ host }) => checkoutRuntime.shipments.commandSource({ host }),
  states: (snapshot) => ({
    shipmentId: snapshot.context.shipmentId,
    status: snapshot.context.status,
    etaLabel: snapshot.context.etaLabel,
  }),
  commands: ({ actor }) => ({
    refresh: (shipmentId: string) =>
      actor.send({ type: "shipment.refresh", shipmentId }),
    requestLabel: (shipmentId: string) =>
      actor.ask?.({ type: "shipment.label.request", shipmentId }),
  }),
});
```

Keep ordinary UI projections focused on business/read-model fields. Opt into runtime metadata only when the component needs it:

```ts
states: (snapshot) => ({
  shipmentId: snapshot.context.shipmentId,
  status: snapshot.context.status,
  syncState: snapshot.transport.state,
});
```

## Runtime model

- commands express intent
- the source-native snapshot defines truth
- `states(snapshot)` derives the consumer-facing read model
- the registration renderer owns the view
- effects express consequences

Headless runtime APIs are available on the same component contract:

```ts
const result = await toggle.execute({ command: "toggle" });
result.snapshot; // paired native observation, not a new public raw getter
toggle.get('states');
toggle.get('schema');
toggle.on("toggled", handler);
toggle.watch((states, prevStates) => {});
```

Use ordinary tests over runtime results, source-owned asynchronous outcomes, and real registered DOM controls. Release subscriptions explicitly and stop sources only when the application/test owns them. The development candidate retires `test`, its dedicated testing/story types, `record(name)`, and the accessibility bridge. Portable receipts and complete lifecycle histories are intentionally removed, not replaced by another recorder. See the [testing migration](https://0xjcf.github.io/ignite-element/api/testing-dsl/).

## Package contract

Source-backed owners expose `get`, `watch`, `on`, `execute`, and `dispose`.
An unregistered owner releases Ignite observations on disposal; borrowed sources
remain application-owned. An Ignite-created private XState actor is stopped once.
Successful registration prevents owning-core disposal. Catalogue reads are pure,
immutable and retained after disposal: null input/payload/state schemas mean
unknown, not inferred validation. Tools need explicit application schemas.

`ignite-element/react` exports the neutral `useIgnite` hook. Prepare once with
`core.get('states')` in owner bootstrap, not rendering; the hook borrows a stable
immutable projection cache. The custom-element wrapper `igniteReact` moves to
`ignite-element/react/web`. Host-dependent Actor-Web factories move to
`ignite-element/actor-web/web`; neutral factories do not transfer native close
authority. SSR and device execution are not implied by the headless API.

- All four v3 packages are native ESM-only. Consumers use ESM imports; public ESM entrypoints and declarations remain supported.
- `ignite-element` is the default public package.
- `ignite-element/xstate`, `ignite-element/redux`, and `ignite-element/mobx` are the default public adapter entrypoints.
- `ignite-element/actor-web` is the optional advanced runtime bridge for host apps that already use Actor-Web.
- `ignite-element/jsx` plus its JSX runtime subpaths are the stable JSX entrypoints.
- `@ignite-element/core` is limited to adapter-neutral contracts, event/effect typing, and small shared utilities.
- `@ignite-element/adapters` is limited to adapter factories, guards, and source-specific config/types.
- `@ignite-element/renderer` remains the advanced renderer/runtime layer for custom renderer integration, shared style injection, and legacy config compatibility work.

Normal facade/JSX consumers do not install scoped packages directly. A consumer that imports `@ignite-element/renderer/lit` must declare both `@ignite-element/renderer` and `lit-html` as direct dependencies.

Actor-Web remains outside the Ignite runtime boundary. Actor-Web owns
orchestration, transport, and long-lived runtime coordination; Ignite consumes
Actor-Web projection/read-model state through the adapter entrypoint. See
`docs/adr-003-shared-arc.md` and `docs/shared-architecture-model.md` for the
boundary model.

## Documentation

- API docs: `../../docs/api/README.md`
- Host app integration: `../../docs/site/src/content/docs/guides/host-app-integration.mdx`
- Platform contracts: `../../docs/site/src/content/docs/guides/platform-contracts.mdx`
- Testing guide: `../../docs/testing.md`
- Advanced config and renderer compatibility: `../../docs/site/src/content/docs/api/define-ignite-config.mdx`
- Migration guide: `../../docs/migrations/v2.2.3-effects-events.md`
- Package boundary migration: `../../docs/migrations/adr-003-package-boundaries.md`
- Examples: `src/examples`

## Headless Node boundary

In the development candidate, supported Node imports and source-backed runtime operations use native events without fake browser globals or hidden DOM elements. Root source-free `const core = igniteCore()` is only a registrar. Register a tag in a real browser; missing DOM capabilities cause a synchronous registration-specific error. Renderer defaults are selected at registration, with explicit overrides taking precedence without resolving defaults.

The prepared `3.0.0-beta.12` candidate includes explicit unregistered-core disposal and neutral root/adapter declarations for no-DOM consumers; it is awaiting publication verification. Unsubscribing one observation does not dispose its owner. Final disposal releases Ignite-owned observations and its private factory-created actor, never caller-owned source shutdown. Browser-only wrappers remain on `ignite-element/react/web` and `ignite-element/actor-web/web`. Authentic Actor-Web neutral-source construction requires the separately prepared `@actor-web/runtime@0.3.0` `/source` boundary; foreign structural controllers need no Actor-Web runtime dependency.
