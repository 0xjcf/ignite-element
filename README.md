# ignite-element

Platform-native custom elements built around explicit intent, derived state, deterministic effects, and DOM-native contracts.

Ignite Element lets you build systems where:

- commands express intent
- state defines truth
- effects express consequences
- custom elements expose the public contract

That makes components easier to reason about for developers, easier to reuse across host apps, and directly operable by AI agents.

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

- platform-native distribution through custom elements and `CustomEvent`
- typed boundaries between intent, state, effects, and rendering
- reusable stateful UI without shipping an app framework runtime
- a headless runtime for testing and automation

Ignite is not trying to replace your app framework. It gives you a browser-native distribution layer for stateful UI: project behavior into a custom element, expose DOM-native events, and keep the same contract usable in plain HTML, React, Vue, tests, and automation.

## Quick start

> **v3 is in beta.** Install with `@beta` — the stable `latest` tag is still
> v2.2.x. The state libraries are optional peer dependencies, so only the one
> you install is pulled in. See the [v2 → v3 migration guide](./docs/site/src/content/docs/migration/v3.mdx).

Install Ignite Element with the one state library you use.

```bash
npm install ignite-element@beta xstate
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

For the default path, you do not need `ignite.config.ts`, a bundler plugin, or shared adapter teardown overrides.

Co-locate component CSS in ordinary `<style>` tags and keep it next to the JSX that uses it:

```tsx
const toggleStyles = `
  :host { display: inline-block; }
  button { min-width: 5rem; }
`;

toggle("toggle-button", ({ isOn, toggle }) => (
  <>
    <style>{toggleStyles}</style>
    <button onClick={toggle}>{isOn ? "On" : "Off"}</button>
  </>
));
```

If your bundler can import CSS as text, you can swap `toggleStyles` for an imported string. Use `ignite.config.ts` only for shared shadow-root styles, diagnostics, or opting into `lit`. For hosts with strict `style-src` CSP rules, prefer emitted stylesheet URLs through shared styles instead of inline `<style>` tags.

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

  view: ({ matches }) => ({
    isOn: matches("on"),
  }),

  commands: ({ actor }) => ({
    toggle: () => {
      actor.send({ type: "TOGGLE" });
    },
  }),

  effects: ({ emit, select }) => {
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

Because the outward contract is DOM-native, the same component can be consumed from plain HTML or host frameworks without a wrapper-specific protocol.

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
view: ({ matches }) => ({
  isOn: matches("on")
})
```

This keeps rendering tied to explicit state, not ad hoc imperative updates.

### Effects = consequences

Effects react to state transitions.

```ts
effects: ({ emit, select }) => {
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
effects: ({ snapshot, emit, host, select }) => {
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
async function inspectToggle() {
  const eventSubscription = toggle.on("toggled", (event) => {
    console.log(event.isOn);
  });
  const snapshotSubscription = toggle.watchSnapshot((state, prevState) => {
    console.log(prevState.value, "->", state.value);
  });
  const viewSubscription = toggle.watchView((view, prevView) => {
    console.log(prevView.isOn, "->", view.isOn);
  });

  try {
    const result = await toggle.execute({ command: "toggle" });
    toggle.getSnapshot();
    toggle.getView();
    toggle.getSchema();
  } finally {
    eventSubscription.unsubscribe();
    snapshotSubscription.unsubscribe();
    viewSubscription.unsubscribe();
  }
}
```

Use `on(...)` for outward event signals, `watchSnapshot(...)` for raw state changes, and `watchView(...)` for projected view changes.

Use `record(...)` when a test or agent needs workflow evidence:

```ts
async function recordToggleStory() {
  const story = toggle.record("turns on");
  await story.execute({ command: "toggle" });
  story.trace();
  story.lifecycle();
  story.summary();
  story.stop();
}
```

`execute()` returns structured output:

```ts
{
  snapshot,
  events: [{ type: "toggled", isOn: true }]
}
```

`getSchema()` returns a JSON-serializable description of the component contract:

```ts
{
  commands: {
    toggle: {}
  },
  events: [{ type: "toggled" }],
  snapshot: { value: "off", context: {} }
}
```

This makes the same component usable in the browser, in tests, and in automation workflows.

## Testing

Ignite includes a built-in headless testing DSL for state and event assertions.

```ts
import { test as igniteTest } from "ignite-element";

(await igniteTest({ component: toggle })
  .given({ value: "off" })
  .when({ command: "toggle" }))
  .expectSnapshot({ value: "on" })
  .expectEvent({ type: "toggled", isOn: true });
```

Because this runs against the same deterministic runtime, state and event expectations stay aligned with real component behavior.

## Installation matrix

- XState: `npm install ignite-element@beta xstate`
- Redux: `npm install ignite-element@beta @reduxjs/toolkit`
- MobX: `npm install ignite-element@beta mobx`

## Package map

`ignite-element` is the default public package. Unless you are extending Ignite itself, this is the package you should install and document against.

- `ignite-element`: default public package for app and component authors
- `ignite-element/xstate`, `ignite-element/redux`, `ignite-element/mobx`: default public adapter entrypoints
- `@ignite-element/core`: advanced adapter-neutral contracts, event/effect typing, and shared utilities
- `@ignite-element/adapters`: advanced adapter factories, guards, and source-specific config/types
- `@ignite-element/renderer`: advanced renderer/runtime layer for custom renderer integration work

These scoped packages are internal dependencies of `ignite-element` and install automatically; you don't add them directly.

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
  toggle.view.ts
  toggle.commands.ts
  toggle.effects.ts
  toggle.events.ts
  toggle.view.tsx
```

This structure works well for both human maintainers and agent tooling because the execution model is explicit.

## Documentation

- [API docs](./docs/site/src/content/docs/api/ignite-core.mdx)
- [Host app integration](./docs/site/src/content/docs/guides/host-app-integration.mdx)
- [Platform contracts](./docs/site/src/content/docs/guides/platform-contracts.mdx)
- [Testing guide](./docs/site/src/content/docs/guides/testing.mdx)
- [Configuration and renderers](./docs/site/src/content/docs/api/define-ignite-config.mdx)
- [State adapter lifecycle](./docs/site/src/content/docs/concepts/state-adapters.mdx)
- [Migration guide](./docs/migrations/v2.2.3-effects-events.md)
- [Package boundary migration](./docs/migrations/adr-003-package-boundaries.md)
- Advanced package layers: `ignite-core`, `ignite-adapters`, and `ignite-renderer`
- [Local examples](./examples)

## Philosophy

Ignite enforces three rules:

1. Commands express intent.
2. State defines truth.
3. Effects express consequences.

The result is a deterministic UI architecture that scales from ordinary component work to testing, automation, and AI-agent execution.
