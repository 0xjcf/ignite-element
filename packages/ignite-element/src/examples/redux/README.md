# Redux + ignite-element Example

This example shows how ignite-element integrates with **Redux Toolkit**, **Ignite JSX**, and **Bootstrap** to drive both shared and isolated counters through the public `ignite-element/redux` authoring surface.

---

## Quick Start

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Run the dev server**

   ```bash
   pnpm run dev
   ```

3. **Explore the components**

   Open the local URL (typically <http://localhost:5173>) to see:

   - A shared counter backed by a long-lived Redux store instance.
   - An isolated counter created from a slice so each element has its own store.
   - A shared read-only display consuming the same derived facade data.

---

## Core Files

| Path | Purpose |
| --- | --- |
| `src/js/reduxCounterStore.ts` | Exports the slice and a store factory used throughout the example. |
| `src/js/reduxCounterStore.test.ts` | Unit tests for the slice reducers and store isolation. |
| `src/js/reduxExample.tsx` | Registers components with `igniteCore` using shared and isolated scopes rendered via Ignite JSX. |
| `src/index.html` | Host page for the custom elements during development. |

---

## igniteCore Usage

The example uses two kinds of sources:

- **Shared store instance** → reuse across every component registration.
- **Slice definition** → create a fresh store per component (isolated scope).

```tsx
import { igniteCore } from "ignite-element/redux";

export const registerSharedRedux = igniteCore({
  source: counterStore(),
  view: ({ snapshot }) => ({
    count: snapshot.counter.count,
  }),
  commands: ({ actor }) => ({
    decrement: () => actor.dispatch(counterSlice.actions.decrement()),
    increment: () => actor.dispatch(counterSlice.actions.increment()),
    addByAmount: (value: number) =>
      actor.dispatch(counterSlice.actions.addByAmount(value)),
  }),
});

export const registerIsolatedRedux = igniteCore({
  source: counterSlice,
  view: ({ snapshot }) => ({
    count: snapshot.count,
  }),
  commands: ({ actor }) => ({
    decrement: () => actor.dispatch(counterSlice.actions.decrement()),
    increment: () => actor.dispatch(counterSlice.actions.increment()),
    addByAmount: (value: number) =>
      actor.dispatch(counterSlice.actions.addByAmount(value)),
  }),
});
```

Each registered element receives the projected **view** fields (e.g. `count`) and the **commands** you declared (`increment`, `decrement`, `addByAmount`) — template functions focus purely on UI concerns, expressing intent through commands rather than dispatching raw actions.

---

## Styling with Bootstrap (config-free)

Ignite renders each component into its own Shadow DOM, so Bootstrap's classes
can't reach component internals from a global `<link>`. The example imports
Bootstrap's stylesheet as raw text and injects a `<style>` into each component's
shadow root — no `ignite.config.ts`, no sass build step:

```tsx
import bootstrapStyles from "bootstrap/dist/css/bootstrap.min.css?raw";

registerSharedRedux("my-counter-redux", ({ count, decrement }) => (
  <div class="card">
    <style>{bootstrapStyles}</style>
    {/* …Bootstrap-classed markup… */}
  </div>
));
```

This keeps the demo dependency-light at the tooling layer (just Vite) while
showing Ignite works with any CSS framework. For app-wide chrome you'd still
link a sheet in `index.html`; the `?raw` injection is what crosses the shadow
boundary.

---

## Tips & Experiments

- Swap the slice actions or add thunks—anything wired through Redux Toolkit will flow into the `commands` facade.
- Try rerendering the shared counter in multiple places to see state synchronisation in action.
- Extend the isolated example with extra slice state to confirm each element remains independent.

Have fun experimenting with ignite-element and Redux! Contributions and feedback are welcome in the main repository.
