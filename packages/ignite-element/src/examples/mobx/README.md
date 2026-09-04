# MobX + ignite-element Example

This showcase combines **ignite-element**, **MobX**, and **lit-html** to build reactive custom elements with both shared and isolated state through the public `ignite-element/mobx` authoring surface.

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

3. **Interact with the components**

   Open the reported URL (default <http://localhost:5173>) to try:

   - A shared counter reusing a single MobX store instance.
   - An isolated variant that instantiates a fresh store per element.
   - A read-only display that consumes the same shared derived data.

---

## Key Files

| Path | Purpose |
| --- | --- |
| `mobxCounterStore.ts` | Exposes the `counterStore` factory used for both shared and isolated flows. |
| `mobxExample.ts` | Registers components with `igniteCore` using MobX inference. |
| `theme.css` | Global styling applied via `setGlobalStyles`. |
| `another-counter-mobx.css` | Extra styles for the isolated component. |

---

## igniteCore Setup

We reuse the same `view`/`commands` facades for both shared and isolated scopes. The only difference is whether we pass a live observable or a factory:

```ts
import { igniteCore } from "ignite-element/mobx";

const sharedStore = counterStore();

export const registerSharedMobx = igniteCore({
  source: sharedStore, // shared observable instance
  view: ({ snapshot }) => ({ count: snapshot.count }),
  commands: ({ actor }) => ({
    decrement: () => actor.decrement(),
    increment: () => actor.increment(),
  }),
});

export const registerIsolatedMobx = igniteCore({
  source: counterStore, // factory → new observable each time
  view: ({ snapshot }) => ({ count: snapshot.count }),
  commands: ({ actor }) => ({
    decrement: () => actor.decrement(),
    increment: () => actor.increment(),
  }),
});
```

Every renderer receives the derived `count`, the command helpers, and the underlying adapter metadata (`state`, `send`) from ignite-element.

---

## Styling Strategy

- **Global theme**: applied once via `setGlobalStyles(themeHref)`.
- **Component overrides**: the isolated example links to `another-counter-mobx.css` to demonstrate per-element styling.
- **Design tokens**: CSS variables in `theme.css` make it easy to reskin the shared components without touching the render logic.

---

## Suggested Experiments

- Add new MobX actions (e.g. reset) and surface them through the `commands` facade.
- Introduce computed getters in the store and include them in `view(...)` to see how recalculations propagate.
- Render multiple isolated counters side-by-side to confirm each maintains its own observable state.

Enjoy building with ignite-element and MobX! Questions or ideas? Open an issue or start a discussion in the main repository.
