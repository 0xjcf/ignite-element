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
- 📘 **TypeScript Support:** Rich inference for `state` and `send` arguments across adapters.
- ⚡ **Minimal Bundle Size:** Designed to add only a few kilobytes on top of your chosen state library.

---

## 🚀 Quick Start

Get up and running in 30 seconds:

```typescript
// 1. Install
npm install ignite-element lit-html xstate

// 2. Create your first component
import { html } from "lit-html";
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
  adapter: "xstate",
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

component("toggle-button", ({ isOn, presses, toggle, increment }) => html`
    <button @click=${toggle}>
      ${isOn ? "On" : "Off"} (pressed ${presses} times)
    </button>
    <button @click=${increment}>Add Press</button>
  `,
);

// 3. Use it anywhere in HTML
// <toggle-button></toggle-button>
```

Need a shared instance? Start an actor (or reuse a Redux store / MobX observable) yourself and pass it to `igniteCore`.

---

## 🛠️ Installation

Ignite-Element currently uses `lit-html` for rendering templates. Rendering abstraction is on the roadmap, but for now `lit-html` is required.

**Install with your preferred state library:**

- **XState**
  ```bash
  npm install ignite-element lit-html xstate
  ```
- **Redux**
  ```bash
  npm install ignite-element lit-html @reduxjs/toolkit
  ```
- **MobX**
  ```bash
  npm install ignite-element lit-html mobx
  ```

---

## 🧠 Core Concepts

### Shared vs. Isolated Scope

- **Shared scope** – provide a running instance (XState actor, Redux store, MobX observable). Every call to the returned `component` function reuses that instance, so elements stay in sync.
- **Isolated scope** – pass a factory / definition (XState machine, Redux slice, MobX store factory). Each element receives its own isolated state tree.

Ignite-Element automatically infers the scope, so you rarely need extra configuration.

> **Tip:** When you supply a long-lived instance (like an XState actor) you control the lifecycle. Start it before first use and stop it when the host app tears down.

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

## 📋 Migration Guide

### Upgrading from pre-1.4.x

- **Use callback facades:** Provide `states(snapshot)` and `commands(actor)` callbacks that return plain objects. Their values merge into the render arguments.
  ```ts
  const component = igniteCore({
    adapter: "redux",
    source: store,
    states: (snapshot) => ({ count: snapshot.counter.count }),
    commands: (store) => ({ increment: () => store.dispatch(...) }),
  });
  ```
- **Register renderers directly:** The registration function now accepts render functions, `{ render }` objects, or classes. If you previously instantiated a renderer manually, you can pass the class itself (`component("my-tag", MyRenderer)`).
- **Deprecated helpers:** `initialTransition` and `resolveState` are removed—use the snapshot provided to `states` or call `adapter.getState()` when needed.
- **Styling:** Prefer `setGlobalStyles(new URL("./styles.css", import.meta.url).href)` (or the forthcoming `ignite.config.ts`) to keep paths correct in modern bundlers.

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

| Package | Size (min + gzip) |
| --- | --- |
| ignite-element | ~3.2 KB |
| + lit-html | ~5.1 KB |
| **Total** | **~8.3 KB** |

_State management libraries are peer dependencies and are not included in these totals._

---

## 🎨 Styling Options

Choose global, scoped, or dynamic styling strategies:

- **Global:** Load CSS once via `setGlobalStyles`.
- **Scoped:** Append `<style>` or `<link>` inside your render function (see MobX example).
- **Dynamic:** Compute styles based on state and inline them with `style=` attributes (see XState gradient tally component).

See the [Styling Guide](https://joseflores.gitbook.io/ignite-element/core-concepts/styling-with-ignite-element) for deeper coverage.

---

## 📖 Documentation

- [Getting Started](https://joseflores.gitbook.io/ignite-element/getting-started)
- [Core Concepts](https://joseflores.gitbook.io/ignite-element/core-concepts)
- [API Reference](https://joseflores.gitbook.io/ignite-element/api)
- [Styling](https://joseflores.gitbook.io/ignite-element/styling)
- [Examples](https://joseflores.gitbook.io/ignite-element/examples)

---

## 🔧 Troubleshooting

| Symptom | Fix |
| --- | --- |
| Component not rendering | Ensure `lit-html` is installed and that the custom element tag is registered. |
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
