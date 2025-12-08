# XState + ignite-element Example

Build and render web components backed by XState actors and machines with almost zero boilerplate. This example pairs **ignite-element**, **XState**, **Ignite JSX**, and **TailwindCSS** to demonstrate both shared and isolated state scopes.

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

3. **Open the playground**

   Visit the URL printed in the terminal (usually <http://localhost:5173>). You will see:

   - A shared counter that reuses a single XState actor across multiple components.
   - An isolated counter where each element spawns its own machine instance.
   - Auxiliary renderers (e.g. gradient tally) consuming the same shared facade data.

---

## Project Layout

| Path | Purpose |
| --- | --- |
| `advancedCounterMachine.ts` | The XState machine definition used for both shared and isolated variants. |
| `xstateExample.tsx` | Registers web components via `igniteCore` using the Ignite JSX renderer. |
| `dist/styles.css` | Tailwind build output applied globally via `setGlobalStyles`. |
| `index.html` | Hosts the custom elements during development. |

---

## igniteCore in Action

`igniteCore` now infers the adapter from the `source` you provide—no explicit discriminator required. The shared and isolated registrations look like this:

```ts
const sharedActor = createActor(advancedMachine);
sharedActor.start();

const registerSharedXState = igniteCore({
  source: sharedActor, // shared actor → shared scope
  states: (snapshot) => ({
    count: snapshot.context.count,
    darkMode: snapshot.context.darkMode,
    containerClasses: snapshot.context.darkMode
      ? "p-4 bg-gray-800 text-white border rounded-md mb-2"
      : "p-4 bg-gray-100 text-black border rounded-md mb-2",
  }),
  commands: ({ actor }) => ({
    increment: () => actor.send({ type: "INC" }),
    decrement: () => actor.send({ type: "DEC" }),
    toggleDarkMode: () => actor.send({ type: "TOGGLE_DARK" }),
  }),
});

const registerIsolatedXState = igniteCore({
  source: advancedMachine, // machine → isolated scope per element
  states: (snapshot) => ({
    count: snapshot.context.count,
    darkMode: snapshot.context.darkMode,
    containerClasses: snapshot.context.darkMode
      ? "p-4 bg-gray-800 text-white border rounded-md mb-2"
      : "p-4 bg-gray-100 text-black border rounded-md mb-2",
  }),
  commands: ({ actor }) => ({
    increment: () => actor.send({ type: "INC" }),
    decrement: () => actor.send({ type: "DEC" }),
    toggleDarkMode: () => actor.send({ type: "TOGGLE_DARK" }),
  }),
});
```

Every registered component receives the merged facade values: the derived state from `states(...)`, the command helpers from `commands(...)`, and the underlying `state`/`send` utilities from the adapter.

---

## Styling

TailwindCSS is compiled once and injected globally via `ignite.config.ts`:

```ts
import { defineIgniteConfig } from "ignite-element";

export default defineIgniteConfig({
  globalStyles: new URL("./dist/styles.css", import.meta.url).href,
  renderer: "ignite-jsx",
});
```

Component-specific tweaks live alongside the render functions, so you can mix Tailwind utility classes with custom CSS snippets.

---

## Tips & Next Steps

- **Shared vs. isolated**: pass a running actor for shared state, or a machine for isolated instances. ignite-element figures it out for you.
- **Facade composition**: memoize expensive selectors inside `states(...)`—it only runs when the adapter snapshot changes.
- **Try decorators**: if you prefer class syntax, the `Shared`/`Isolated` decorators from `ignite-element` work seamlessly with the inferred facades showcased here.
- **Experiment**: extend the machine with additional states or actions, expose them through the `commands` facade, and render them in a new component.

Enjoy exploring ignite-element with XState! If you run into issues, file a ticket on the main repository or share feedback in the discussions tab.
