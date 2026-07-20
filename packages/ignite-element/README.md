# ignite-element

Default public package for building platform-native custom elements with explicit intent, derived view state, deterministic effects, and DOM-native events.

> **v3 is in beta.** Install with `@beta` — the stable `latest` tag is still
> v2.2.x. The state libraries are optional peer dependencies, so only the one
> you install is pulled in.

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
  view: ({ snapshot }) => ({
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

Use `ignite-element/xstate` when Ignite owns the element's local behavior and lifecycle.

Use `ignite-element/actor-web` when an Actor-Web runtime already owns orchestration, transport, sequencing, and source lifecycle. In that mode Ignite stays projection-first: it consumes Actor-Web snapshots, derives view state, and sends explicit requests back with `actor.send(...)` or `actor.ask(...)`. `actor.ask` is optional and only exists on sources that support request/response.

```ts
import { igniteCore } from "ignite-element/actor-web";

const shipmentCard = igniteCore({
  source: ({ host }) => checkoutRuntime.shipments.commandSource({ host }),
  view: ({ snapshot }) => ({
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
view: ({ snapshot }) => ({
  shipmentId: snapshot.context.shipmentId,
  status: snapshot.context.status,
  syncState: snapshot.transport.state,
});
```

## Runtime model

- commands express intent
- state defines truth
- effects express consequences

Headless runtime APIs are available on the same component contract:

```ts
await toggle.execute({ command: "toggle" });
toggle.getSnapshot();
toggle.getView();
toggle.getSchema();
toggle.on("toggled", handler);
toggle.watchSnapshot((snapshot, prevSnapshot) => {});
toggle.watchView((view, prevView) => {});
const story = toggle.record("turns on");
await story.execute({ command: "toggle" });
story.trace();
story.lifecycle();
story.summary();
story.stop();
```

For testing vocabulary, keep the layers distinct:

- `igniteTest({ component }).story(...)` states an expected multi-step user experience.
- `record(name)` captures the observed execution evidence for that experience.
- `snapshotStory(story)` turns that Story into a serializable portable receipt.

The story helper composes over the existing Story recorder. It does not add a second recorder, trace format, or runtime authority.

## Package contract

- `ignite-element` is the default public package.
- `ignite-element/xstate`, `ignite-element/redux`, and `ignite-element/mobx` are the default public adapter entrypoints.
- `ignite-element/actor-web` is the optional advanced runtime bridge for host apps that already use Actor-Web.
- `ignite-element/jsx` plus its JSX runtime subpaths are the stable JSX entrypoints.
- `@ignite-element/core` is limited to adapter-neutral contracts, event/effect typing, and small shared utilities.
- `@ignite-element/adapters` is limited to adapter factories, guards, and source-specific config/types.
- `@ignite-element/renderer` remains the advanced renderer/runtime layer for custom renderer integration, shared style injection, and legacy config compatibility work.

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
