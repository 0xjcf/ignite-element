# ignite-element

[![CI Build](https://github.com/0xjcf/ignite-element/actions/workflows/ci.yml/badge.svg)](https://github.com/0xjcf/ignite-element/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ignite-element.svg)](https://www.npmjs.com/package/ignite-element)
[![Bundlephobia](https://img.shields.io/bundlephobia/minzip/ignite-element.svg)](https://bundlephobia.com/package/ignite-element)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript Ready](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![codecov](https://codecov.io/github/0xjcf/ignite-element/graph/badge.svg?token=6SSFPOV9J8)](https://codecov.io/github/0xjcf/ignite-element)
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/0xjcf/ignite-element?utm_source=oss&utm_medium=github&utm_campaign=0xjcf%2Fignite-element&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

---

## 🆕 What's New in v2.0.0

### Highlights

- **Central configuration:** Define global styles, default renderer, and future options via a project-level `ignite.config.ts`. First-party plugins for Vite and Webpack auto-inject the config at build time.
- **Ignite JSX by default:** Ignite Element now ships its own JSX renderer with zero React/Solid dependencies. Swap back to lit by changing a single line in your config.
- **Typed event emission:** Declare an events map in `igniteCore` and receive a typed `emit` helper plus host reference inside command callbacks.
- **Adapter inference & entry points:** `igniteCore` infers XState, Redux, and MobX adapters from the provided source and exposes adapter-specific entry points that keep optional peers out of unrelated bundles.
- **Shared adapter lifecycle:** Shared adapters use reference counting to clean up automatically while still allowing manual control for long-lived hosts.
- **Documentation refresh:** README, guides, and migration notes cover the new config workflow, renderer strategies, and typed events API.

See the [full changelog](CHANGELOG.md) for detailed updates.

---

## ✨ Overview

**Ignite-Element** is a lightweight, framework-agnostic library for building modular, state-driven web components. Built on standards like **Custom Elements**, **Shadow DOM**, and **ES Modules**, Ignite-Element helps developers ship scalable UI systems with minimal boilerplate.

---

## 🎯 Key Features

- 🎯 **State Management Made Easy:** Works with **XState**, **Redux**, and **MobX**, automatically inferring the right adapter for shared or isolated scope.
- 🧭 **Centralised Configuration:** Manage global styles, renderer choice, and future options from `ignite.config.ts` with Vite/Webpack plugins that inject the config for you.
- 💡 **Ignite JSX Runtime:** Author JSX without React/Solid dependencies—Ignite JSX ships as the default renderer, while lit remains one config change away.
- 📣 **Typed Events & Commands:** Facade callbacks provide derived state, a typed `emit` helper, and host access so components can talk back to their parents safely.
- 📘 **TypeScript Support:** Rich inference for render args across every adapter and facade combination.
- ⚡ **Minimal Bundle Size:** Designed to add only a few kilobytes on top of your chosen state library.

---

## 🚀 Quick Start

Get up and running in a few steps:

1. **Install**

   ```bash
   npm install ignite-element xstate
   ```

1. **Create `ignite.config.ts`**

   ```ts
   import { defineIgniteConfig } from "ignite-element";

   export default defineIgniteConfig({
     globalStyles: new URL("./styles.css", import.meta.url).href,
     renderer: "ignite-jsx", // or "lit"
   });
   ```

1. **Wire the Vite plugin** (Webpack plugin exported at `ignite-element/config/webpack`)

   ```ts
   // vite.config.ts
   import { defineConfig } from "vite";
   import { igniteConfigVitePlugin } from "ignite-element/config/vite";

   export default defineConfig({
     plugins: [igniteConfigVitePlugin()],
   });
   ```

1. **Create your first component**

   ```tsx
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
     events: (event) => ({
       incremented: event<{ presses: number }>(),
     }),
     states: (snapshot) => ({
       isOn: snapshot.matches("on"),
       presses: snapshot.context.presses,
     }),
     commands: ({ actor, emit }) => ({
       toggle: () => actor.send({ type: "TOGGLE" }),
       increment: () => {
         actor.send({ type: "INCREMENT" });
         emit("incremented", { presses: actor.getSnapshot().context.presses });
       },
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

   document
     .querySelector("toggle-button")
     ?.addEventListener("incremented", (event) =>
       console.log("Pressed:", event.detail.presses),
     );
   ```

1. **Use the element**

   ```html
   <toggle-button></toggle-button>
   ```

---

## 🧭 Recommended Patterns

### Let state machines own side effects

Facade `commands` should stay lightweight—ideally only forwarding host interactions to the underlying state machine and firing typed DOM events via the `emit` helper. When you need to announce that a state transition completed, register an emitter with the machine instead of subscribing to the actor from the façade:

```ts
const registerEntryForm = igniteCore({
  source: entryFormMachine,
  events: (event) => ({
    "performance-entry:submitted": event<{ entry: PerformanceEntry }>(),
  }),
  commands: ({ actor, emit, host }) => {
    actor.send({
      type: "REGISTER_SUBMISSION_EMITTER",
      emitter: (entry) => emit("performance-entry:submitted", { entry }),
    });

    return {
      submit: () => actor.send({ type: "SUBMIT" }),
      reset: () => actor.send({ type: "RESET_FORM" }),
    };
  },
});
```

Pair that with a machine that accepts the emitter, stores it in context, and invokes it only after a successful submission:

```ts
interface EntryFormContext {
  submissionEmitter: ((entry: PerformanceEntry) => void) | null;
  lastSubmittedEntry: PerformanceEntry | null;
  // other context fields…
}

type EntryFormEvent =
  | { type: "REGISTER_SUBMISSION_EMITTER"; emitter: (entry: PerformanceEntry) => void }
  | { type: "SUBMIT" }
  | { type: "done.invoke.submitEntry"; output: PerformanceEntry }
  | /* other events */;

const entryFormMachine = setup({
  types: { context: {} as EntryFormContext, events: {} as EntryFormEvent },
  actions: {
    notifySubmission: ({ context }) => {
      if (!context.submissionEmitter || !context.lastSubmittedEntry) {
        return;
      }
      context.submissionEmitter(structuredClone(context.lastSubmittedEntry));
    },
  },
}).createMachine({
  context: () => ({
    submissionEmitter: null,
    lastSubmittedEntry: null,
  }),
  on: {
    REGISTER_SUBMISSION_EMITTER: {
      actions: assign(({ event }) => ({
        submissionEmitter: event.emitter,
      })),
    },
  },
  states: {
    submitting: {
      invoke: {
        src: "submitEntry",
        onDone: {
          target: "success",
          actions: assign(({ event }) => ({
            lastSubmittedEntry: structuredClone(event.output),
          })),
        },
      },
    },
    success: {
      entry: "notifySubmission",
      after: { 2000: "idle" },
    },
    idle: { /* … */ },
  },
});
```

No extra subscriptions are necessary—the machine decides when a side effect should run, the façade merely exposes the DOM event the host cares about.

### Pair Ignite with atomic design

Ignite components play nicely with an atomic design system:

- **Atoms** render the smallest interactive controls (inputs, toggles, buttons). They receive only the data/state they need and emit simple events (`onInput`, `onToggle`, etc.).
- **Molecules/Organisms** are the JSX renderers you register via `igniteCore`. They compose atoms, read derived state from the facade, and call façade commands in response to UI events.
- **Templates/State machines** keep business rules—validation, async workflows, retries, notifications—encapsulated. Machines emit events to the facade, which in turn raises DOM events for the host application.

Keeping those layers separate means you can iterate on styling (atoms), composition (molecules), and behavior (machines) independently while Ignite handles the plumbing between them.

---

## 🧱 Integration Walkthrough

We’re documenting the end-to-end integration flow as we rebuild the onboarding experience. Each step captures what we run locally while wiring Ignite into a fresh Vite + TypeScript host; these notes will drive the scaffold CLI defaults.

### Step 1 — Bootstrap the host workspace

- **Prerequisites:** Node 22+, pnpm 8+, and a clean working directory for the host app.
- **Create the project shell:** `pnpm create vite@latest leaderboard --template vanilla-ts` (or point at an existing Vite setup).
- **Install runtime deps:** `pnpm add ignite-element xstate` keeps the state adapter available from day one.
- **Install build tooling:** `pnpm add -D tailwindcss @tailwindcss/postcss autoprefixer` so the Ignite components can reuse the Tailwind-based tokens from the examples.
- **(Optional) link a local copy:** when iterating on Ignite itself, run `pnpm add ignite-element@file:../ignite-element` from the host repo so changes to `dist/` flow through instantly.

> ✅ Verify: `pnpm install` completes without registry errors and `pnpm list ignite-element` reports the expected version or link target.

Next step: capture the configuration edits (tsconfig, Tailwind, and Vite wiring) once the host workspace is in place.

### Step 2 — Configure the toolchain for Ignite JSX

- **TypeScript JSX runtime:** update `tsconfig.json` so JSX emits against Ignite.

  ```jsonc
  {
    "compilerOptions": {
      "jsx": "react-jsx",
      "jsxImportSource": "ignite-element/jsx",
      "moduleResolution": "bundler"
    }
  }
  ```

  Those settings mirror Vite defaults and keep the Ignite JSX runtime (and its dev helpers) discoverable without extra Babel plugins.

- **Path fallbacks:** add `@/*` (or your preferred alias) so components can import `src` cleanly; keep any existing aliases intact.

  ```jsonc
  {
    "compilerOptions": {
      "baseUrl": ".",
      "paths": {
        "@/*": ["src/*"]
      }
    }
  }
  ```

- **Tailwind 4 + tokens:** create `src/styles/global.css` with the Tailwind entrypoint and tokens import (see Step 5 for an extended example). This file will be referenced from `ignite.config.ts`.

- **Linting considerations:** Biome 2024.10 does not yet understand Tailwind v4 `@source` directives. Skip them for now and rely on `tailwind.config.ts` content globs instead.

> ✅ Verify: `pnpm typecheck` (or `pnpm lint`) passes after the TypeScript config change; Vite should still launch with `pnpm dev`.

Next step: introduce `ignite.config.ts`, wire the Vite plugin, and register the component entry points.

### Step 3 — Add `ignite.config.ts` and global styling

- **Create the config:** at the host project root, add `ignite.config.ts`.

  ```ts
  import { defineIgniteConfig } from "ignite-element";

  export default defineIgniteConfig({
    renderer: "ignite-jsx",
    globalStyles: new URL("./src/styles/global.css", import.meta.url).href,
  });
  ```

  - `renderer: "ignite-jsx"` keeps the default JSX runtime; swap to `"lit"` if you prefer template literals.
  - Point `globalStyles` at whatever CSS file establishes your design tokens (created in Step 2).

- **Reference tokens + Tailwind:** ensure `src/styles/global.css` imports both your tokens and Tailwind once:

  ```css
  @import "./tokens.css";
  @import "tailwindcss";
  ```

  You can layer additional base styles below those imports (typography resets, color variables, etc.).

- **Make the config discoverable:** the upcoming Vite plugin (Step 4) will load the file automatically, so no manual import is required. If you want to smoke-test before wiring the plugin, add `import "../ignite.config.ts";` to your entry file temporarily, then remove it once Step 4 is complete.

> ✅ Verify: `pnpm dev` runs without missing-style errors once `ignite.config.ts` exists.

Next step: replace the temporary import by wiring the Vite plugin, then register a facade-driven component.

### Step 4 — Wire Vite + the Ignite JSX runtime

- **Replace the manual import with the plugin:** update `vite.config.ts` to install `igniteConfigVitePlugin`. The plugin injects `ignite.config.ts` automatically for dev and preview builds.

```ts
  import { igniteConfigVitePlugin } from "ignite-element/config/vite";

import { defineConfig } from "vite";

const igniteConfigPlugin = igniteConfigVitePlugin();

export default defineConfig({
 server: {
  port: 8080
 },
 plugins: [igniteConfigPlugin],
});

```

  Ignite now ships a lightweight DOM polyfill and JSX runtime helpers, so no extra stubs or path aliases are necessary.

- **Linking a local build?** If your app consumes a sibling `ignite-element` directory via `pnpm add ignite-element@file:../ignite-element`, add that parent directory to `server.fs.allow` (e.g. `allow: [process.cwd(), "../ignite-element"]`) so Vite can serve the linked `dist/` files. Published installs do not require this.

- **Remove the manual config import:** delete the temporary `import "./ignite.config.ts";` from your app entry—the plugin now loads it automatically.

- **Use the bundled JSX helpers:** JSX now resolves via `import type { IgniteJsxElement } from "ignite-element/jsx";` and the runtime helpers (`jsx`, `jsxs`, `jsxDEV`) come from `ignite-element/jsx/jsx-runtime` (and `jsx-dev-runtime` for development). No additional shims or path overrides are required.

> ✅ Verify: `pnpm dev` injects a module script that loads `ignite.config.ts`, and `pnpm typecheck` no longer complains about missing `ignite-element/jsx` modules.

Next step: register your first Ignite component (facade + renderer) and mount it in the host app.
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

Ignite-Element ships with the Ignite JSX runtime by default. Prefer template literals? Install `lit-html` and flip the renderer in `ignite.config.ts`.

### 1. Install the core + your state library

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

### 2. Configure TypeScript (JSX projects)

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "ignite-element/jsx"
  }
}
```

### 3. Declare project-wide defaults

```ts
// ignite.config.ts
import { defineIgniteConfig } from "ignite-element/config";

export default defineIgniteConfig({
  globalStyles: new URL("./styles.css", import.meta.url).href,
  renderer: "ignite-jsx", // or "lit"
});
```

### 4. Register the config plugin (optional but recommended)

- **Vite**

  ```ts
  import { defineConfig } from "vite";
  import { igniteConfigVitePlugin } from "ignite-element/config/vite";

  export default defineConfig({
    plugins: [igniteConfigVitePlugin()],
  });
  ```

- **Webpack**

  ```ts
  const { IgniteConfigWebpackPlugin } = require("ignite-element/config/webpack");

  module.exports = {
    plugins: [new IgniteConfigWebpackPlugin()],
  };
  ```

Prefer lit templates? Install `lit-html`, set `renderer: "lit"` in the config above, and the plugins will load the lit strategy automatically. Without the plugin you can fall back to a single `import "ignite-element/renderers/lit"` at app start.

---

## 🧠 Core Concepts

### Type inference tips

You don’t need new helpers to keep TypeScript happy—the exported types for each adapter already cover the common cases. A few examples:

```ts
const component = igniteCore({
  source: counterSlice,
  states: (snapshot) => ({ count: snapshot.counter.count }),
  commands: ({ actor }) => ({
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

### Facade callbacks

`igniteCore` merges the outputs of your facade callbacks into the render arguments:

- `states(snapshot)` derives the values your component needs to display.
- `commands({ actor, emit, host })` exposes the actions your component can perform and, when events are declared, a typed `emit` helper plus host reference.

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

### Styling

You can:

- Declare site-wide styles in `ignite.config.ts` (`globalStyles` accepts a string URL or object literal stylesheet).
- Provide custom CSS per component.
- Combine both for progressive enhancement.

Fallback: when a bundler plugin cannot be used (e.g. plain script tag), call `setGlobalStyles` manually before registering components.

```ts
import { setGlobalStyles } from "ignite-element";

setGlobalStyles(new URL("./styles.css", import.meta.url).href);
```

---

## 📚 Examples

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

## ✅ v2 DX Milestones

Highlights from the [v2 DX plan](plans/DONE/ignite-v2-dx/task-list.md):

- [x] Design a central configuration API (`defineIgniteConfig`) with Vite/Webpack plugins.
- [x] Split renderer strategies and ship Ignite JSX as the default runtime.
- [x] Infer adapters automatically (Redux slice/store, XState machine/actor, MobX observable/factory).
- [x] Add typed events + host context to commands, keeping render args type-safe.
- [x] Reference-count shared adapters so they clean up when the last host disconnects.
- [x] Refresh documentation and examples to use the new config workflow.
- [x] Extend test coverage across config loading, renderer strategies, typed events, and adapter lifecycle.

### Up next

- [ ] Publish an expanded v1 → v2 migration guide with IDE helpers.
- [ ] Explore IDE/codegen tooling (codemod, snippets) for common facade patterns.
- [ ] Document best practices for cross-framework distribution (npm vs. CDN).

---

## 📋 Migration Guide

### Upgrading from pre-1.4.x

- **Use callback facades:** Provide `states(snapshot)` and `commands({ actor, emit, host })` callbacks that return plain objects. Their values merge into the render arguments.
  
  ```ts
  const component = igniteCore({
    source: store,
    states: (snapshot) => ({ count: snapshot.counter.count }),
    commands: ({ actor }) => ({ increment: () => actor.dispatch(counterSlice.actions.increment()) }),
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
