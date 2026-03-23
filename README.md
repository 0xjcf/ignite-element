# ignite-element

Framework-agnostic Web Components built around explicit intent, derived state, and deterministic effects.

Ignite Element lets you build systems where:

- commands express intent
- state defines truth
- effects express consequences

That makes components easier to reason about for developers and directly operable by AI agents.

Quick links: [Quick start](#quick-start) · [Mental model](#mental-model) · [Agent runtime](#agent-runtime) · [Testing](#testing) · [Install matrix](#installation-matrix) · [Documentation](#documentation)

## Why Ignite Element?

Most UI systems blur together rendering, state changes, and side effects.

Ignite keeps them separate:

```txt
command (intent)
      ↓
state transition
      ↓
effect (consequence)
      ↓
UI render
```

This gives you:

- deterministic behavior
- typed boundaries
- observable event flow
- reusable stateful Web Components
- a headless runtime for automation and testing

## Quick start

Install Ignite Element with your preferred state library.

```bash
npm install ignite-element xstate
```

If you use the built-in JSX runtime, enable Ignite JSX once in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "ignite-element/jsx"
  }
}
```

If you cannot change `tsconfig`, add this per file:

```ts
/** @jsxImportSource ignite-element/jsx */
```

For the default path, you do not need `ignite.config.ts`, a bundler plugin, or lifecycle overrides.

Create a component:

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
    toggle: () => {
      actor.send({ type: "TOGGLE" });
    },
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

Use it anywhere the browser can render a custom element:

```html
<toggle-button></toggle-button>
```

## Mental model

### Commands = intent

Commands describe what should happen.

```ts
commands: ({ actor, host }) => ({
  toggle: () => actor.send({ type: "TOGGLE" })
})
```

Commands:

- do not emit events
- do not contain outward side effects
- express intent through the adapter actor or store

### State = truth

State is projected into the render surface.

```ts
view: ({ snapshot }) => ({
  isOn: snapshot.matches("on")
})
```

This keeps rendering tied to explicit state, not ad hoc imperative updates.

### Effects = consequences

Effects react to state transitions.

```ts
effects: (_snapshot, _prevSnapshot, { emit, select }) => {
  const isOn = select((snapshot) => snapshot.matches("on"));
  if (!isOn.changed) return;
  emit("toggled", { isOn: isOn.current });
}
```

Effects:

- run after state updates
- can read `snapshot`, `prevSnapshot`, `actor`, `host`, and `emit`
- expose `select(...)` for common transition comparisons
- emit typed DOM events
- support deterministic testing and replay-safe workflows

When one transition needs multiple consequences, keep each concern in its own guarded block inside the same `effects(...)` callback:

```ts
effects: (snapshot, _prevSnapshot, { emit, host, select }) => {
  const status = select((current) => current.context.status);
  const error = select((current) => current.context.error);

  if (status.changed && status.current === "saved") {
    emit("saved", { id: snapshot.context.id });
  }

  if (error.changed && error.current) {
    emit("save-failed", { message: error.current });
  }

  if (status.changed) {
    host.dataset.status = status.current;
  }
}
```

For larger components, extract each branch into a small helper and call those helpers from the single `effects(...)` callback.

### Events = public contract

```ts
events: (event) => ({
  toggled: event<{ isOn: boolean }>()
})
```

Events are:

- typed
- observable
- DOM-native
- usable by parent components, tests, and agent runtimes

## Agent runtime

Every `igniteCore(...)` registration exposes a headless runtime API in addition to the DOM component.

```ts
const result = toggle.execute("toggle");
toggle.getState();
toggle.getView();
toggle.getSchema();
toggle.on("toggled", (event) => {
  console.log(event.detail.isOn);
});
toggle.watch((state, prevState) => {
  console.log(prevState.value, "->", state.value);
});
toggle.watchView((view, prevView) => {
  console.log(prevView.isOn, "->", view.isOn);
});
```

Use `on(...)` for outward event signals, `watch(...)` for raw state changes, and `watchView(...)` for projected view changes.

`execute()` returns structured output:

```ts
{
  state,
  events: [{ type: "toggled", payload: { isOn: true } }]
}
```

`getSchema()` returns a JSON-serializable description of the component contract:

```ts
{
  commands: ["toggle"],
  events: ["toggled"],
  state: { value: "off", context: {} }
}
```

This makes the same component usable in the browser, in tests, and in automation workflows.

## Testing

Ignite includes a built-in headless testing DSL for state and event assertions.

```ts
import { test as igniteTest } from "ignite-element";

igniteTest(toggle)
  .given("off")
  .when("toggle")
  .expectState("on")
  .expectEvent("toggled", { isOn: true });
```

Because this runs against the same deterministic runtime, state and event expectations stay aligned with real component behavior.

## Installation matrix

- XState: `npm install ignite-element xstate`
- Redux: `npm install ignite-element @reduxjs/toolkit`
- MobX: `npm install ignite-element mobx`

## Multiple components from one core

Define behavior once and register multiple render surfaces from the same core.

```ts
const toggle = igniteCore({
  source: machine,
  events: toggleEvents,
  view: toggleView,
  commands: toggleCommands,
  effects: toggleEffects,
});

toggle("toggle-button", ToggleButtonView);
toggle("toggle-chip", ToggleChipView);
toggle("toggle-menu-item", ToggleMenuItemView);
```

## Recommended file structure

```txt
toggle/
  toggle.core.ts
  toggle.machine.ts
  toggle.states.ts
  toggle.commands.ts
  toggle.effects.ts
  toggle.events.ts
  toggle.view.tsx
```

This structure works well for both human maintainers and agent tooling because the execution model is explicit.

## Documentation

- [API docs](./docs/site/src/content/docs/api/ignite-core.mdx)
- [Testing guide](./docs/site/src/content/docs/guides/testing.mdx)
- [Configuration and renderers](./docs/site/src/content/docs/api/define-ignite-config.mdx)
- [State adapter lifecycle](./docs/site/src/content/docs/concepts/state-adapters.mdx)
- [Migration guide](./docs/migrations/v2.2.3-effects-events.md)
- [Local examples](./packages/ignite-element/src/examples)

## Philosophy

Ignite enforces three rules:

1. Commands express intent.
2. State defines truth.
3. Effects express consequences.

The result is a deterministic UI architecture that scales from ordinary component work to testing, automation, and AI-agent execution.
