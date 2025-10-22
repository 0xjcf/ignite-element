# Redux + ignite-element Example

This example shows how ignite-element integrates with **Redux Toolkit**, **lit-html**, and **Bootstrap** to drive both shared and isolated counters. Adapter inference means you no longer have to declare `adapter: "redux"`—igniteCore figures it out from the source you provide.

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
| `reduxCounterStore.ts` | Exports the slice and a store factory used throughout the example. |
| `reduxExample.ts` | Registers components with `igniteCore` using shared and isolated scopes. |
| `scss/styles.scss` | Bootstrap + custom overrides compiled once and injected globally. |
| `index.html` | Host page for the custom elements during development. |

---

## igniteCore Usage

The example uses two kinds of sources:

- **Shared store instance** → reuse across every component registration.
- **Slice definition** → create a fresh store per component (isolated scope).

```ts
const sharedStore = counterStore();

export const registerSharedRedux = igniteCore({
  source: sharedStore, // inferred as shared Redux adapter
  states: (snapshot) => ({
    count: snapshot.counter.count,
  }),
  commands: (actor) => ({
    decrement: () => actor.dispatch(counterSlice.actions.decrement()),
    increment: () => actor.dispatch(counterSlice.actions.increment()),
    addByAmount: (value: number) =>
      actor.dispatch(counterSlice.actions.addByAmount(value)),
  }),
});

export const registerIsolatedRedux = igniteCore({
  source: counterSlice, // slice → new store per element
  states: (snapshot) => ({
    count: snapshot.counter.count,
  }),
  commands: (actor) => ({
    decrement: () => actor.dispatch(counterSlice.actions.decrement()),
    increment: () => actor.dispatch(counterSlice.actions.increment()),
    addByAmount: (value: number) =>
      actor.dispatch(counterSlice.actions.addByAmount(value)),
  }),
});
```

Each registered element receives `state`, `send`, and the derived facade helpers, letting template functions or classes focus purely on UI concerns.

---

## Styling with Bootstrap

Bootstrap is bundled once for the entire example and applied via `setGlobalStyles`:

```ts
import { setGlobalStyles } from "ignite-element";

const stylesHref = new URL("../scss/styles.scss", import.meta.url).href;
setGlobalStyles(stylesHref);
```

Individual components can layer on additional markup or include isolated styles (e.g. `link` tags) as needed.

---

## Tips & Experiments

- Swap the slice actions or add thunks—anything wired through Redux Toolkit will flow into the `commands` facade.
- Try rerendering the shared counter in multiple places to see state synchronisation in action.
- Extend the isolated example with extra slice state to confirm each element remains independent.

Have fun experimenting with ignite-element and Redux! Contributions and feedback are welcome in the main repository.
