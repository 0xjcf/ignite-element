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

**Ignite-Element** is a framework-agnostic way to build stateful Custom Elements. Bring your state library (XState, Redux, MobX), get typed `commands`, `states`, and `emit`, and render with the built-in Ignite JSX runtime or lit.

Quick links: [Quick start](#quick-start-vite) · [Install matrix](#installation-matrix) · [Typed events](#typed-events) · [Styling](#styling) · [Examples](#examples)

## Why use it?

- Works with XState, Redux, or MobX (shared or per-element state, inferred automatically)
- Fully Typed commands and emit
- Tiny runtime; no React/Solid dependency for JSX
- Configurable renderer and global styles through `ignite.config.ts`

## Quick start (Vite)

1) Install

```bash
npm install ignite-element xstate
```

2) TypeScript JSX (required if you use the Ignite JSX renderer)

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

3) Add config (all fields are optional)

```ts
// ignite.config.ts
import { defineIgniteConfig } from "ignite-element/config";
export default defineIgniteConfig({
  styles: new URL("./styles.css", import.meta.url).href,
  renderer: "ignite-jsx", // or "lit"
  logging: "warn",
});
```

4) Wire the Vite plugin

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { igniteConfigVitePlugin } from "ignite-element/config/vite";
export default defineConfig({ plugins: [igniteConfigVitePlugin()] });
```

5) Create a component

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
  states: (snapshot) => ({ isOn: snapshot.matches("on") }),
  commands: ({ actor, emit }) => ({
    toggle: () => {
      actor.send({ type: "TOGGLE" });
      emit("toggled", { isOn: actor.getSnapshot().matches("on") });
    },
  }),
});

component("toggle-button", ({ isOn, toggle }) => (
  <button onClick={toggle}>{isOn ? "On" : "Off"}</button>
));
```

6) Use it

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
  states: (snapshot) => ({ count: snapshot.context.count }),
});

shared("shared-counter", ({ count }) => <span>{count}</span>);

// Stop the actor when your host application shuts down
window.addEventListener("beforeunload", () => actor.stop());
```

Use the same approach for shared Redux stores, MobX observables, or any custom adapters: set `cleanup: false` if they outlive your elements and stop them yourself when the host app shuts down.

### Facade callbacks

`igniteCore` merges the outputs of your facade callbacks into the render arguments:

- `states(snapshot)` derives the values your component needs to display.
- `commands({ actor, emit, host })` returns the actions your component can call; when you declare `events`, it also includes the typed `emit` helper and the `host` element.

Both callbacks run once per adapter instance (shared) or per element (isolated), so you can safely memoize values or close over resources without worrying about duplicate subscriptions.

### Typed events

Opt in by declaring an `events` map:

```ts
const registerCounter = igniteCore({
  source: counterSlice,
  events: (event) => ({
    "counter:incremented": event<{ amount: number }>(),
  }),
  commands: ({ actor, emit }) => ({
    add: (amount: number) => {
      actor.dispatch(counterSlice.actions.addByAmount(amount));
      emit("counter:incremented", { amount });
    },
  }),
});
```

Commands receive `{ actor, emit, host }`. The `emit` helper dispatches bubbling, composed `CustomEvent` instances so parents can listen with `addEventListener`. When no `events` map is supplied the helper is omitted, keeping render args lean.

> Heads-up: event name inference is most reliable when `events` is declared before `commands`. We’re tightening this in a future release.

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
