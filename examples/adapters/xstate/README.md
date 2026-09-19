# XState + Ignite Element (v3) Example

This is the Ignite JSX v3 example referenced in the docs. It pairs **ignite-element**, **XState**, and **TailwindCSS** to show shared vs. isolated actors through the public `ignite-element/xstate` authoring surface.

The example uses:

- adapter entrypoints come from `ignite-element/xstate`
- JSX runtime setup points at `ignite-element/jsx`
- local component CSS can live in ordinary `<style>{styles}</style>` output

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

   Visit the URL printed in the terminal (usually <http://localhost:8080>). You will see:

   - A shared counter that reuses a single XState actor across multiple components.
   - An isolated counter where each element spawns its own machine instance.
   - Auxiliary renderers (e.g. gradient tally) consuming the same shared facade data.

**From the repo root** you can also run:

```bash
pnpm run examples:xstate
```

## Project Layout

| Path | Purpose |
| --- | --- |
| `apiShowcaseMachine.ts` | Compact machine used by the API showcase for state transitions, limits, and command history. |
| `advancedCounterMachine.ts` | The XState machine definition used for both shared and isolated variants. |
| `xstateAgentRuntimeShowcase.tsx` | Demonstrates the headless agent runtime API exposed by the same `igniteCore(...)` registration. |
| `xstateApiShowcaseRuntime.ts` | Exports the shared `apiShowcase` runtime contract used by both showcase elements. |
| `xstateApiShowcase.tsx` | Renders the v3 authoring API: `states`, `commands`, declared events, effects, and a renderer view. |
| `xstateExample.tsx` | Registers web components via `igniteCore` using the Ignite JSX renderer. |
| `dist/styles.css` | Tailwind build output linked from `index.html` for playground-wide utility classes. |
| `index.html` | Hosts the custom elements during development. |

## igniteCore in Action

`igniteCore` is imported from `ignite-element/xstate`. It infers scope from the `source` you provide, so no adapter discriminator is needed. The shared and isolated registrations look like this:

```ts
import { createActor } from "xstate";
import { igniteCore } from "ignite-element/xstate";
import { advancedMachine } from "./advancedCounterMachine";

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
  events: (event) => ({
    toggled: event<{ isDark: boolean }>(),
  }),
  commands: ({ source: actor }) => ({
    increment: () => actor.send({ type: "INC" }),
    decrement: () => actor.send({ type: "DEC" }),
    toggleDarkMode: () => actor.send({ type: "TOGGLE_DARK" }),
  }),
  effects: ({ snapshot, prevSnapshot, emit }) => {
    if (snapshot.context.darkMode === prevSnapshot.context.darkMode) return;
    emit({ type: "toggled", isDark: snapshot.context.darkMode });
  },
});

// Isolated variant: same facade as above, just change source to a machine
const registerIsolatedXState = igniteCore({
  source: advancedMachine, // machine → isolated scope per element
  states: (snapshot) => ({ /* same mapping as shared */ }),
  events: (event) => ({ toggled: event<{ isDark: boolean }>() }),
  commands: ({ source: actor }) => ({ /* same commands as shared */ }),
  effects: ({ snapshot, prevSnapshot, emit }) => {
    /* same effects as shared */
  },
});
```

Every registered component receives the projected values from `states(snapshot)` and the semantic command helpers from `commands(...)`; raw adapter `state`/`send` utilities are not part of the public renderer boundary.

Register elements with the direct callback form:

```tsx
registerSharedXState("my-counter-xstate", ({ count, increment }) => (
  <>
    <style>{`
      button {
        border-radius: 999px;
        padding: 0.65rem 1rem;
      }
    `}</style>
    <button type="button" onClick={() => increment()}>
      Count: {count}
    </button>
  </>
));
```

---

## API Showcase

`xstateApiShowcase.tsx` is the recommended starting point for the v3 API shape. It demonstrates:

- `states(snapshot)` for projected render/runtime data
- `commands(...)` for intent helpers backed by the XState actor
- `events(...)` for typed DOM event declarations
- `effects(...)` for emitting events after state changes
- machine states surfaced through `snapshot.matches(...)` and `matchState(...)`

```tsx
const apiShowcase = igniteCore({
  source: apiShowcaseMachine,
  events: (event) => ({
    "api-count-changed": event<{
      count: number;
      previousCount: number;
      state: string;
    }>(),
  }),
  states: (snapshot) => ({
    count: snapshot.context.count,
    stateLabel: matchState(
      snapshot,
      { active: "Active", limited: "Limit reached" },
      "Active",
    ),
  }),
  commands: ({ source: actor }) => ({
    increment: () => actor.send({ type: "ADD", amount: 1 }),
    setLimit: (limit: number) => actor.send({ type: "SET_LIMIT", limit }),
  }),
  effects: ({ snapshot, prevSnapshot, emit }) => {
    if (snapshot.context.count !== prevSnapshot.context.count) {
      emit({
        type: "api-count-changed",
        count: snapshot.context.count,
        previousCount: prevSnapshot.context.count,
        state: String(snapshot.value),
      });
    }
  },
});

apiShowcase("xstate-api-showcase", ({ count, increment }) => (
  <button type="button" onClick={() => increment()}>
    Count: {count}
  </button>
));
```

`xstateAgentRuntimeShowcase.tsx` uses the same `apiShowcase` registration as a headless runtime:

```ts
apiShowcase.get("schema"); // Pure discovery; input schemas remain unknown.
apiShowcase.get("states"); // Prepare the owning observation and command bindings.

apiShowcase.on("api-count-changed", (event) => [
  event.count,
  event.previousCount,
  event.state,
]);
apiShowcase.watch((states, prevStates) => [prevStates, states]);

const result = await apiShowcase.execute({ command: "increment" });
console.log(result.snapshot, result.states); // One paired native/projected observation.

await apiShowcase.execute({ command: "setLimit", input: 6 });
for (let step = 0; step < 20 && apiShowcase.get("states").stateLabel !== "Limit reached"; step += 1) {
  await apiShowcase.execute({ command: "increment" });
}
if (apiShowcase.get("states").stateLabel !== "Limit reached") throw new Error("Limit not reached");
```

The example also exposes the same runtime on `window.__igniteExamples.apiShowcase` so browser automation can prove the contract directly:

```ts
const runtime = window.__igniteExamples?.apiShowcase;
if (!runtime) throw new Error("Runtime unavailable");
await runtime.execute({ command: "reset" });
const result = await runtime.execute({ command: "increment" });
console.log(result.snapshot);
runtime.get("states");
```

---

The v3 runtime does not record stories or lifecycle histories. The bounded loop belongs to this application; asynchronous report work and shutdown remain source/application-owned. Test real controls by role and accessible name, independently of headless state assertions. Terminal `core.dispose()` also releases registered cores. It does not stop borrowed sources; the application owns their shutdown.

`apiShowcaseCommandDefinitions` keeps the application's tool descriptions and input schemas separate from these ordinary commands. For example, `setLimit` retains description "Set maximum count" and `{ type: "number", minimum: 3, maximum: 12 }`. Core discovery reports the name with `input: null`; it does not infer or validate that schema.

## Styling

The happy path is ordinary JSX-local styles plus whatever global CSS your host already loads. This example's playground links `dist/styles.css` from `index.html`, while component-specific tweaks can stay inline:

```tsx
const boxStyles = `
  .box {
    height: 1rem;
    width: 1rem;
    border-radius: 999px;
  }
`;

registerSharedXState("gradient-tally", ({ count }) => (
  <>
    <style>{boxStyles}</style>
    <div
      class="box"
      style={{
        background: `linear-gradient(90deg, rgba(34, 197, 94, 1) 0%, rgba(59, 130, 246, ${(count + 1) / 10}) 100%)`,
      }}
    />
  </>
));
```

To reuse a stylesheet, link it inside each component's shadow root as shown in [Getting started](https://0xjcf.github.io/ignite-element/#build-a-component).

The example Vite config resolves workspace packages to local source files.

---

## Tips & Next Steps

- **Shared vs. isolated**: pass a running actor for shared state, or a machine for isolated instances. ignite-element figures it out for you.
- **Facade composition**: keep lightweight selectors inside `states(snapshot)`; it feeds both renderers and the headless runtime states surface.
- **Registration shape**: prefer `component("element-name", (args) => view)` so every example reads the same way across XState, Redux, and MobX.
- **Experiment**: extend the machine with additional states or actions, expose them through the `commands` facade, and render them in a new component.

## More

- Docs: [ignite-element.dev](https://0xjcf.github.io/ignite-element/)
- Live playground: [StackBlitz demo](https://stackblitz.com/edit/ignite-element?file=src%2Fmy-counter.tsx)

Enjoy exploring ignite-element with XState! If you run into issues, file a ticket on the main repository or share feedback in the discussions tab.
