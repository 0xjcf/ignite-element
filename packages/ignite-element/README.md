# ignite-element

Default public package for building platform-native custom elements with explicit intent, derived view state, deterministic effects, and DOM-native events.

Most users should install `ignite-element` and one state library:

- XState: `npm install ignite-element xstate`
- Redux: `npm install ignite-element @reduxjs/toolkit`
- MobX: `npm install ignite-element mobx`

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

Quick start:

```tsx
import { createMachine } from "xstate";
import { igniteCore } from "ignite-element/xstate";

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
  effects: (_snapshot, _prevSnapshot, { emit, select }) => {
    const isOn = select((snapshot) => snapshot.matches("on"));
    if (!isOn.changed) return;
    emit("toggled", { isOn: isOn.current });
  },
});

toggle("toggle-button", ({ isOn, toggle }) => (
  <button onClick={toggle}>{isOn ? "On" : "Off"}</button>
));
```

The resulting element can be consumed anywhere the browser can render a custom element, including plain HTML and host frameworks like React or Vue.

## Runtime model

- commands express intent
- state defines truth
- effects express consequences

Headless runtime APIs are available on the same component contract:

```ts
toggle.execute("toggle");
toggle.getState();
toggle.getView();
toggle.getSchema();
toggle.on("toggled", handler);
toggle.watch((state, prevState) => {});
toggle.watchView((view, prevView) => {});
const story = toggle.record("turns on");
story.execute("toggle");
story.trace();
story.lifecycle();
story.summary();
story.stop();
```

## Package contract

- `ignite-element` is the default public package.
- `ignite-element/xstate`, `ignite-element/redux`, and `ignite-element/mobx` are the default public adapter entrypoints.
- `ignite-element/actor-web` is the optional advanced runtime bridge for host apps that already use Actor-Web.
- `ignite-core` is limited to adapter-neutral contracts, event/effect typing, and small shared utilities.
- `ignite-adapters` is limited to adapter factories, guards, and source-specific config/types.
- `ignite-renderer` remains the advanced renderer/runtime layer for custom renderer integration work.

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
- Configuration and renderers: `../../docs/site/src/content/docs/api/define-ignite-config.mdx`
- Migration guide: `../../docs/migrations/v2.2.3-effects-events.md`
- Package boundary migration: `../../docs/migrations/adr-003-package-boundaries.md`
- Examples: `src/examples`
