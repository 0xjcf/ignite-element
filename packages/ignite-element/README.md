# ignite-element

[![CI Build](https://github.com/0xjcf/ignite-element/actions/workflows/ci.yml/badge.svg)](https://github.com/0xjcf/ignite-element/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ignite-element.svg)](https://www.npmjs.com/package/ignite-element)
[![Bundlephobia](https://img.shields.io/bundlephobia/minzip/ignite-element.svg)](https://bundlephobia.com/package/ignite-element)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](https://bundlephobia.com/package/ignite-element)
[![Tree-shakeable](https://img.shields.io/badge/tree--shakeable-yes-blue.svg)](https://bundlephobia.com/package/ignite-element)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript Ready](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![codecov](https://codecov.io/github/0xjcf/ignite-element/graph/badge.svg?token=6SSFPOV9J8)](https://codecov.io/github/0xjcf/ignite-element)
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/0xjcf/ignite-element?utm_source=oss&utm_medium=github&utm_campaign=0xjcf%2Fignite-element&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

---

**Ignite-Element** is a framework-agnostic way to build stateful Custom Elements. Bring your state library (XState, Redux, MobX), keep `commands` focused on intent, model consequences in `effects`, and render with the built-in Ignite JSX runtime or lit.

Quick links: [Quick start](#quick-start-vite) · [Install matrix](#installation-matrix) · [Typed events](#typed-events) · [Styling](#styling) · [Examples](#examples)

## Why use it?

- Works with XState, Redux, or MobX (shared or per-element state, inferred automatically)
- Fully typed commands, state facades, effects, and events
- Tiny runtime; no React/Solid dependency for JSX
- Configurable renderer and global styles through `ignite.config.ts`

## Quick start (Vite)

1. Install

```bash
npm install ignite-element xstate
```

1. TypeScript JSX (required if you use the Ignite JSX renderer)

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "ignite-element/jsx"
  }
}
```

If you can’t change `tsconfig`, add `/** @jsxImportSource ignite-element/jsx */` at the top of each JSX/TSX file instead.

1. Add config (all fields are optional)

```ts
// ignite.config.ts
import { defineIgniteConfig } from "ignite-element/config";
export default defineIgniteConfig({
  styles: new URL("./styles.css", import.meta.url).href,
  renderer: "ignite-jsx", // or "lit"
  logging: "warn",
});
```

1. Wire the Vite plugin

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { igniteConfigVitePlugin } from "ignite-element/config/vite";
export default defineConfig({ plugins: [igniteConfigVitePlugin()] });
```

1. Create a component

```tsx
import { createMachine } from "xstate";
import { igniteCore } from "ignite-element/xstate";

const machine = createMachine({ 
  initial: "off", 
  states: { 
    off: { on: { TOGGLE: "on" } }, 
    on: { on: { TOGGLE: "off" } } 
  } 
});

const component = igniteCore({
  source: machine,
  events: (event) => ({ toggled: event<{ isOn: boolean }>() }),
  view: ({ snapshot }) => ({ isOn: snapshot.matches("on") }),
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

component("toggle-button", ({ isOn, toggle }) => (
  <button onClick={toggle}>{isOn ? "On" : "Off"}</button>
));
```

1. Use it

```html
<toggle-button></toggle-button>
```

## Installation matrix

- XState: `npm install ignite-element xstate`
- Redux: `npm install ignite-element @reduxjs/toolkit`
- MobX: `npm install ignite-element mobx`

### Cleanup & Teardown

- **Isolated adapters** (the default when you pass factories or definitions) are created per custom element. Ignite Element automatically calls `stop()` on disconnect, so no extra work is required.
- **Shared adapters** (long-lived instances you construct once) are reference-counted and stopped automatically when the final element disconnects. Set `cleanup: false` if you want to keep them alive and stop them manually.

```ts
// Shared XState actor example
const actor = createActor(machine);
actor.start();

const shared = igniteCore({
  source: actor,
  cleanup: false, // leave actor running until the host decides to stop it
  view: ({ snapshot }) => ({ count: snapshot.context.count }),
});

shared("shared-counter", ({ count }) => <span>{count}</span>);

// Stop the actor when your host application shuts down
window.addEventListener("beforeunload", () => actor.stop());
```

Use the same approach for shared Redux stores, MobX observables, or any custom adapters: set `cleanup: false` if they outlive your elements and stop them yourself when the host app shuts down.

### Facade callbacks

`igniteCore` merges the outputs of your facade callbacks into the render arguments:

- `view({ snapshot })` derives the values your component needs to display.
- `commands({ actor, host })` returns the actions your component can call.
- `effects(snapshot, prevSnapshot, { emit, actor, host, select })` maps state transitions to emitted events and other deterministic consequences.

Both callbacks run once per adapter instance (shared) or per element (isolated), so you can safely memoize values or close over resources without worrying about duplicate subscriptions.

### Typed events

Opt in by declaring an `events` map:

```ts
const registerCounter = igniteCore({
  source: counterSlice,
  events: (event) => ({
    "counter:incremented": event<{ amount: number }>(),
  }),
  commands: ({ actor }) => ({
    add: (amount: number) => {
      actor.dispatch(counterSlice.actions.addByAmount(amount));
    },
  }),
  effects: (_snapshot, _prevSnapshot, { emit, select }) => {
    const count = select((snapshot) => snapshot.counter.count);
    if (!count.changed) return;
    emit("counter:incremented", { amount: count.current });
  },
});
```

The `emit` helper belongs in `effects()`. It dispatches bubbling, composed `CustomEvent` instances so parents can listen with `addEventListener`. `commands()` now receive `{ actor, host }` only.

Event typing is independent of object property order, so `events`, `commands`, `view`, and `effects` can be declared in whichever order reads best.

Deterministic effects lifecycle:

- Ignite seeds `prevSnapshot` from the current adapter state when a host/runtime attaches. Historical transitions are not replayed to new hosts.
- `effects(snapshot, prevSnapshot, ctx)` runs only after subsequent adapter updates.
- For mounted elements, effects attach before the render subscription, so emitted events from a transition fire before the next render for that same host.

Migration help:

- Guide: [`docs/migrations/v2.2.3-effects-events.md`](../../docs/migrations/v2.2.3-effects-events.md)
- Scripted assist: `pnpm run migrate:effects-events`

Breaking release note:

- `emit` has been removed from command context.
- Move command-driven DOM events into `effects(snapshot, prevSnapshot, { emit, select })`.

### Agent Runtime

Every `igniteCore(...)` registration now exposes a headless runtime API:

```ts
const result = component.execute("toggle");
component.getState();
component.getView();
component.getSchema();
component.on("toggled", (event) => {
  console.log(event.detail.isOn);
});
component.watch((state, prevState) => {
  console.log(prevState.value, "->", state.value);
});
component.watchView((view, prevView) => {
  console.log(prevView.isOn, "->", view.isOn);
});
```

Use `on(...)` for outward event signals, `watch(...)` for raw state changes, and `watchView(...)` for projected view changes.

`execute()` returns the latest state plus the events emitted during that command:

```ts
{
  state,
  events: [{ type: "toggled", payload: { isOn: true } }]
}
```

`getSchema()` returns a JSON-serializable view of the component contract:

```ts
{
  commands: ["toggle"],
  events: ["toggled"],
  state: { value: "off", context: {} }
}
```

This makes the same component contract usable in the DOM, in tests, and in agent workflows.

### Testing DSL

Use the headless runtime directly in tests with the built-in scenario helper:

```ts
import { test as igniteTest } from "ignite-element";
import { igniteCore } from "ignite-element/xstate";

const component = igniteCore({
  source: machine,
  view: ({ snapshot }) => ({
    isOn: snapshot.matches("on"),
  }),
  commands: ({ actor }) => ({
    toggle: () => actor.send({ type: "TOGGLE" }),
  }),
  events: (event) => ({
    toggled: event<{ isOn: boolean }>(),
  }),
  effects: (_snapshot, _prevSnapshot, { emit, select }) => {
    const isOn = select((snapshot) => snapshot.matches("on"));
    if (!isOn.changed) return;
    emit("toggled", { isOn: isOn.current });
  },
});

igniteTest(component)
  .given("off")
  .when("toggle")
  .expectState("on")
  .expectEvent("toggled", { isOn: true });
```

The helper asserts against `execute()` results, so state and event expectations stay deterministic and replay-friendly.

### Styling

You can:

- Declare component-wide styles in `ignite.config.ts` (`styles`, formerly `globalStyles`, accepts a string URL or object literal stylesheet). These are injected into each component’s **shadow root**, not the page’s light DOM.
- Provide custom CSS per component.
- Combine both for progressive enhancement.

For page shell / light-DOM styling (e.g. body background, layout), import a stylesheet in your app entry or include a `<link>` in `index.html`. Use `styles` for the component layer.

If you aren’t using the Vite/Webpack plugins, keep `ignite.config.ts` and import it in your app’s entry point (e.g. `main.ts`) so `styles` and renderer defaults are applied before you register components.

---

## Examples

Every example demonstrates a different pattern and styling approach:

| Example | State Library | Styling | Highlights |
| --- | --- | --- | --- |
| [XState + Tailwind](./src/examples/xstate) | XState | Tailwind CSS | Isolated machine vs. shared actor, gradient sub-component |
| [Redux + Bootstrap](./src/examples/redux) | Redux Toolkit | Bootstrap | Store factory vs. shared store, scoped Bootstrap link injection |
| [MobX + Custom](./src/examples/mobx) | MobX | Custom CSS | Observable reuse vs. new instances, hybrid global + component styles |

### Run locally

```bash
pnpm run examples:xstate
pnpm run examples:redux
pnpm run examples:mobx
```

> 💡 Start with the XState example to see shared and isolated behaviour side-by-side.

---

## 🌐 Browser Support

Ignite-Element targets evergreen browsers with:

- Custom Elements v1
- Shadow DOM v1
- ES Modules

| Chrome | Firefox | Safari | Edge |
| --- | --- | --- | --- |
| ✅ 67+ | ✅ 63+ | ✅ 10.1+ | ✅ 79+ |

For legacy support, include the [webcomponents polyfills](https://github.com/webcomponents/polyfills).

---

## 📦 Bundle Size

| Package | Description | Size (min + gzip) |
| --- | --- | --- |
| `ignite-element` | Core runtime (facades, adapters) | ~3.2 KB |
| `ignite-element` (Ignite JSX) | Core runtime + Ignite JSX renderer | ~4.2 KB |
| `ignite-element` + `lit-html` | Optional lit strategy | ~8.3 KB |

_Rendering engines and state libraries (`lit-html`, XState, Redux Toolkit, MobX) are optional peer dependencies. Mix only what your project needs—ignite-element itself adds ~4 KB on top of the stack you choose._

---

---

## 📖 Documentation

- [Ignite Element v2 (Starlight)](https://0xjcf.github.io/ignite-element/)
- [Getting Started (v2)](https://0xjcf.github.io/ignite-element/getting-started/installation/)
- [Core Concepts (v2)](https://0xjcf.github.io/ignite-element/concepts/state-adapters/)
- [API Notes](docs/api/README.md)
- [Styling Guide](docs/styling/README.md)
- [Examples Overview](docs/examples/README.md)

---

## 🔧 Troubleshooting

| Symptom | Fix |
| --- | --- |
| Component not rendering | Ensure you've configured `jsxImportSource` (or installed `lit-html` and selected the lit strategy). |
| State not updating | Confirm you’re using the provided `send` function and that your store/machine handles the event. |
| TypeScript errors | Align adapter dependencies (`xstate`, `@reduxjs/toolkit`, `mobx`) with the versions in package peer requirements. |

Need more help? Check the [FAQ](https://joseflores.gitbook.io/ignite-element/faq) or [open an issue](https://github.com/0xjcf/ignite-element/issues).

---

## 🎯 When to Use Ignite-Element

**Best fit:**

- Building reusable, state-driven component libraries.
- Projects that need framework flexibility or native web component distribution.
- Teams looking for deterministic state management with minimal runtime overhead.

**Consider alternatives when:**

- You are deeply invested in a single framework (React, Vue, etc.) and prefer their native component models.
- Server-side rendering is a strict requirement today (SSR support is on the roadmap).

---

## 🤝 Contributing

We welcome all contributions!

- 🐛 [Report bugs](https://github.com/0xjcf/ignite-element/issues/new?template=bug_report.md)
- 💡 [Propose ideas](https://github.com/0xjcf/ignite-element/discussions)
- 📝 Improve docs, clarify examples, or fix typos
- 🔨 Submit pull requests

### Development setup

```bash
git clone https://github.com/<your-username>/ignite-element.git
cd ignite-element
pnpm install
git checkout -b feature/my-awesome-feature
pnpm test
```

Please review our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

---

## 📜 License

Ignite-Element is released under the MIT License.

---

## 💬 Feedback

We appreciate feedback—let us know what helps or what’s missing.

- [Open an issue](https://github.com/0xjcf/ignite-element/issues)
- [Join GitHub Discussions](https://github.com/0xjcf/ignite-element/discussions)
