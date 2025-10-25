# ignite-element

[![CI Build](https://github.com/0xjcf/ignite-element/actions/workflows/ci.yml/badge.svg)](https://github.com/0xjcf/ignite-element/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ignite-element.svg)](https://www.npmjs.com/package/ignite-element)
[![Bundlephobia](https://img.shields.io/bundlephobia/minzip/ignite-element.svg)](https://bundlephobia.com/package/ignite-element)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript Ready](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![codecov](https://codecov.io/github/0xjcf/ignite-element/graph/badge.svg?token=6SSFPOV9J8)](https://codecov.io/github/0xjcf/ignite-element)

---

## 🆕 What's New in v1.4.7

**Release Date:** TBD

### Key Changes

- **Callback facade:** `igniteCore` now accepts `states(snapshot)` and `commands(actor)` callbacks. The render arguments you receive already include these derived values alongside the `send` helper, replacing the old mapping objects.
- **Flexible renderer support:** The registration function (`(tag, renderer) => void`) now accepts plain functions, objects with a `render` method, or classes so you can share renderer instances safely.
- **Shared vs. isolated detection:** Passing a running XState actor / Redux store / MobX observable automatically yields shared scope; providing factories or machine definitions yields isolated scope.
- **Styling upgrades:** `setGlobalStyles` resolves asset URLs correctly inside Vite and custom build setups.
- **Renderer roadmap:** An Ignite-authored JSX renderer and strategy abstraction are in progress—watch the checklist below for updates.
- **Bug fixes:** Improved cleanup behaviour in `IgniteElement` and adapters to avoid stale subscriptions.

See the [full changelog](CHANGELOG.md) for detailed updates.

---

## ✨ Overview

**Ignite-Element** is a lightweight, framework-agnostic library for building modular, state-driven web components. Built on standards like **Custom Elements**, **Shadow DOM**, and **ES Modules**, Ignite-Element helps developers ship scalable UI systems with minimal boilerplate.

---

## 🎯 Key Features

- 🎯 **State Management Made Easy:** Works with **XState**, **Redux**, and **MobX**, supporting both shared and isolated instances.
- 🔄 **Reusable Web Components:** Built entirely on modern web standards—no framework lock-in.
- 🎨 **Flexible Styling:** Inject global styles once or add per-component CSS inside the shadow DOM.
- 💡 **Ignite JSX Runtime:** Author JSX without React/Solid dependencies—Ignite JSX ships as the default renderer, with lit-html available as an optional strategy.
- 📘 **TypeScript Support:** Rich inference for `state` and `send` arguments across adapters.
- ⚡ **Minimal Bundle Size:** Designed to add only a few kilobytes on top of your chosen state library.

---

## 🚀 Quick Start

Get up and running in 30 seconds:

```tsx
// 1. Install
npm install ignite-element xstate

// 2. Create your first component
/** @jsxImportSource ignite-element/jsx */
import { igniteCore } from "ignite-element";
import { createMachine, assign } from "xstate";

const toggleMachine = createMachine({
  id: "toggle",
  initial: "off",
  context: { presses: 0 },
  states: {
    off: {
      on: {
        TOGGLE: "on",
        INCREMENT: { actions: assign({ presses: (ctx) => ctx.presses + 1 }) },
      },
    },
    on: {
      on: {
        TOGGLE: "off",
        INCREMENT: { actions: assign({ presses: (ctx) => ctx.presses + 1 }) },
      },
    },
  },
});

const component = igniteCore({
  source: toggleMachine, // isolated – every element gets its own actor
  states: (snapshot) => ({
    isOn: snapshot.matches("on"),
    presses: snapshot.context.presses,
  }),
  commands: (actor) => ({
    toggle: () => actor.send({ type: "TOGGLE" }),
    increment: () => actor.send({ type: "INCREMENT" }),
  }),
});

component("toggle-button", ({ isOn, presses, toggle, increment }) => (
  <div className="stack">
    <button onClick={toggle}>
      {isOn ? "On" : "Off"} (pressed {presses} times)
    </button>
    <button onClick={increment}>Add Press</button>
  </div>
));

// 3. Use it anywhere in HTML
// <toggle-button></toggle-button>
```

### Renderer shapes

`igniteCore` accepts several renderer formats so you can organize UI however you prefer:

```tsx
/** @jsxImportSource ignite-element/jsx */

// Function renderer (most common)
component("my-counter", ({ count }) => <span>{count}</span>);

// Object renderer with a render method
component("my-counter-object", {
  render: ({ count }) => <span>{count}</span>,
});

// Class renderer (instance created per component)
class CounterView {
  render({ count }: { count: number }) {
    return <span>{count}</span>;
  }
}
component("my-counter-class", CounterView);
```

Need a shared instance? Start an actor (or reuse a Redux store / MobX observable) yourself and pass it to `igniteCore`. The adapter is inferred from whatever you pass in—no discriminator required.

---

## 🛠️ Installation

Ignite-Element now ships with the Ignite JSX runtime by default. Prefer template literals? Install `lit-html` and switch the renderer in `ignite.config.ts`.

**Install with your preferred state library:**

- **XState**
  ```bash
  npm install ignite-element xstate
  ```
- **Redux**
  ```bash
  npm install ignite-element @reduxjs/toolkit
  ```
- **MobX**
  ```bash
  npm install ignite-element mobx
  ```

Then opt-in to the Ignite JSX runtime (default) in your project configuration:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "ignite-element/jsx"
  }
}
```

Prefer lit templates? Install `lit-html` and set `renderer: "lit"` in your `ignite.config.ts`.

---

## 🧠 Core Concepts

### Type inference tips

You don’t need new helpers to keep TypeScript happy—the exported types for each adapter already cover the common cases. A few examples:

```ts
const component = igniteCore({
  source: counterSlice,
  states: (snapshot) => ({ count: snapshot.counter.count }),
  commands: (actor) => ({
    increment: () => actor.dispatch(counterSlice.actions.increment()),
  }),
});

type CounterRenderArgs = AdapterPack<typeof component>;
// CounterRenderArgs["count"] ➜ number
```

Need explicit types? Pull them from your state library (e.g. Redux Toolkit’s `ReturnType<typeof counterSlice.reducer>` or XState’s generated machine types) and feed them into the callbacks manually. In most cases, inlining the callbacks inside `igniteCore` gives you full inference without extra helpers.

### Shared vs. Isolated Scope

- **Shared scope** – provide a running instance (XState actor, Redux store, MobX observable). Every call to the returned `component` function reuses that instance, so elements stay in sync.
- **Isolated scope** – pass a factory / definition (XState machine, Redux slice, MobX store factory). Each element receives its own isolated state tree.

Ignite-Element automatically infers the scope, so you rarely need extra configuration.

> **Tip:** When you supply a long-lived instance (like an XState actor) you control the lifecycle. Start it before first use and stop it when the host app tears down.

### Cleanup & Teardown

- **Isolated adapters** (the default when you pass factories or definitions) are created per custom element. Ignite Element automatically calls `stop()` on disconnect, so no extra work is required.
- **Shared adapters** (long-lived instances you construct once) remain running across every custom element that references them. Ignite Element intentionally does **not** stop these instances—you must do that in your host application so the adapter can continue serving other elements.

```ts
// Shared XState actor example
const actor = createActor(machine);
actor.start();

const shared = igniteCore({
  source: actor,
  states: (snapshot) => ({ count: snapshot.context.count }),
});

shared("shared-counter", ({ count }) => <span>{count}</span>);

// Stop the actor when your host application shuts down
window.addEventListener("beforeunload", () => actor.stop());
```

Keep this pattern in mind for Redux stores, MobX observables, or any custom adapters you wire into Ignite Element.

> **Migration Note:** Prior releases required an explicit `adapter` discriminator (e.g. `adapter: "xstate"`). That hint is now optional—existing code keeps working, but you can safely remove the property when the source is an XState machine/actor, Redux slice/store/factory, or MobX observable/factory.

### Facade Callbacks

`igniteCore` merges the outputs of your facade callbacks into the render arguments:

- `states(snapshot)` lets you derive the values your component needs to display.
- `commands(actor)` lets you expose the actions your component can perform.

Both callbacks run once per adapter instance (shared) or per element (isolated), so you can safely memoize values or close over resources without worrying about duplicate subscriptions.

### Styling

You can:

- Inject global styles once via `setGlobalStyles`.
- Provide custom CSS per component.
- Combine both for progressive enhancement.

```typescript
import { setGlobalStyles } from "ignite-element";

const href = new URL("./styles/tailwind.css", import.meta.url).href;
setGlobalStyles(href);
```

---

## 📚 Examples

Every example demonstrates a different pattern and styling approach:

| Example | State Library | Styling | Highlights |
| --- | --- | --- | --- |
| [XState + Tailwind](./src/examples/xstate) | XState | Tailwind CSS | Isolated machine vs. shared actor, gradient sub-component |
| [Redux + Bootstrap](./src/examples/redux) | Redux Toolkit | Bootstrap | Store factory vs. shared store, scoped Bootstrap link injection |
| [MobX + Custom](./src/examples/mobx) | MobX | Custom CSS | Observable reuse vs. new instances, hybrid global + component styles |

**Run locally**

```bash
pnpm run examples:xstate
pnpm run examples:redux
pnpm run examples:mobx
```

> 💡 Start with the XState example to see shared and isolated behaviour side-by-side.

---

## ✅ Roadmap Checklist

Progress tracked against the [acceptance criteria](plans/ACCEPTANCE_CRITERIA.md).

### Core API
- [x] Optional `states(snapshot)` and `commands(actor)` facades on `igniteCore`.
- [x] Registration function accepts function, object, or class renderers.
- [x] Render args merge façade data with `state` and `send` helpers.
- [x] Backwards compatible defaults when callbacks are omitted.

### Facade Typing & Utilities
- [x] Type inference maps adapter-specific façade shapes automatically.
- [x] Invalid façade return types trigger compile-time errors.

### Adapter Behaviour & Lifecycle
- [x] XState adapter supports shared actors and isolated machines.
- [x] Redux adapter handles slices, store factories, and store instances.
- [x] MobX adapter reuses shared observables and manages isolated factories with cleanup.
- [x] Components dispose adapters on disconnect and recreate isolated scopes on reconnect.

### Testing
- [x] Facade behaviour covered for XState, Redux, and MobX (shared & isolated).
- [x] Renderer flexibility verified (function, object, class).
- [x] Regression tests cover scope detection and cleanup paths.

### Documentation & Migration
- [x] README and docs describe façade callbacks and registration patterns.
- [x] Examples showcase the new API with adapter inference.
- [ ] Publish expanded migration guide for v1 → v1.4.7.

### Future Enhancements
- [x] Adapter inference (XState, Redux, MobX sources).
- [x] Centralised config (`ignite.config.(ts|js)`) for global styles/defaults.
- [ ] Ignite JSX renderer strategy (renderer-agnostic core).
- [ ] `attachRenderer` helper for class-based renderers.
- [ ] Developer tooling (codemod, IDE snippets).

---

## 📋 Migration Guide

### Upgrading from pre-1.4.x

- **Use callback facades:** Provide `states(snapshot)` and `commands(actor)` callbacks that return plain objects. Their values merge into the render arguments.
  ```ts
  const component = igniteCore({
    source: store,
    states: (snapshot) => ({ count: snapshot.counter.count }),
    commands: (actor) => ({ increment: () => actor.dispatch(counterSlice.actions.increment()) }),
  });
  ```
- **Drop the discriminator:** `adapter` is optional. Keep it only when inference cannot determine the correct adapter or when using a custom adapter.
- **Register renderers directly:** The registration function now accepts render functions, `{ render }` objects, or classes. If you previously instantiated a renderer manually, you can pass the class itself (`component("my-tag", MyRenderer)`).
- **Deprecated helpers:** `initialTransition` and `resolveState` are removed—use the snapshot provided to `states` or call `adapter.getState()` when needed.
- **Styling:** Prefer `defineIgniteConfig({ globalStyles: new URL("./styles.css", import.meta.url).href })` in `ignite.config.ts` (or a direct `setGlobalStyles` call when you need ad-hoc overrides) to keep paths correct in modern bundlers.

Detailed migration steps (including TypeScript updates) will be published in the docs ahead of the next major release.

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

## 🎨 Styling Options

Choose global, scoped, or dynamic styling strategies:

- **Global:** Configure once via `ignite.config.ts` using `defineIgniteConfig({ globalStyles })` (or call `setGlobalStyles` directly for edge cases).
- **Scoped:** Append `<style>` or `<link>` inside your render function (see MobX example).
- **Dynamic:** Compute styles based on state and inline them with `style=` attributes (see XState gradient tally component).

See the [Styling Guide](docs/styling/README.md) for deeper coverage.

---

## 📖 Documentation

- [Getting Started (GitBook)](https://joseflores.gitbook.io/ignite-element/getting-started)
- [Core Concepts (GitBook)](https://joseflores.gitbook.io/ignite-element/core-concepts)
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

**Development setup**

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

Your feedback helps Ignite-Element grow!

- [Open an issue](https://github.com/0xjcf/ignite-element/issues)
- [Join GitHub Discussions](https://github.com/0xjcf/ignite-element/discussions)

_Suggest improvements, contribute, and help Ignite-Element become your go-to foundation for web components._
