# ignite-element

Default public package for building framework-agnostic Web Components with explicit intent, derived view state, and deterministic effects.

Most users should install `ignite-element` and one state library:

- XState: `npm install ignite-element xstate`
- Redux: `npm install ignite-element @reduxjs/toolkit`
- MobX: `npm install ignite-element mobx`

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
```

## Package contract

- `ignite-element` is the default public package.
- `ignite-element/xstate`, `ignite-element/redux`, and `ignite-element/mobx` are the default public adapter entrypoints.
- `ignite-core`, `ignite-adapters`, and `ignite-renderer` are advanced package layers intended for custom integrations and library-level work.
- `ignite-store` is a temporary compatibility wrapper that re-exports `ignite-adapters`.

## Documentation

- API docs: `docs/site/src/content/docs/api/ignite-core.mdx`
- Testing guide: `docs/site/src/content/docs/guides/testing.mdx`
- Configuration and renderers: `docs/site/src/content/docs/api/define-ignite-config.mdx`
- Migration guide: `docs/migrations/v2.2.3-effects-events.md`
- Examples: `packages/ignite-element/src/examples`
