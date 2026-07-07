# XState + Ignite Element (v3) Example

This is the Ignite JSX v3 example referenced in the docs. It pairs **ignite-element**, **XState**, and **TailwindCSS** to show shared vs. isolated actors through the public `ignite-element/xstate` authoring surface.

The default path here is intentionally config-free:

- adapter entrypoints come from `ignite-element/xstate`
- JSX runtime setup points at `ignite-element/jsx`
- local component CSS can live in ordinary `<style>{styles}</style>` output

`ignite.config.ts`, renderer plugins, and the `lit-html` sample are kept only as advanced compatibility references, not the first-read setup.

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
| `xstateApiShowcase.tsx` | Renders the v3 authoring API: `view`, `commands`, declared events, and effects. |
| `xstateExample.tsx` | Registers web components via `igniteCore` using the Ignite JSX renderer. |
| `dist/styles.css` | Tailwind build output linked from `index.html` for playground-wide utility classes. |
| `index.html` | Hosts the custom elements during development. |
| `ignite.config.ts` | Reference-only advanced compatibility example for shared shadow-root stylesheet injection. This walkthrough does not load it unless you wire an explicit import or restore config-loader/plugin behavior. |

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
  view: ({ snapshot }) => ({
    count: snapshot.context.count,
    darkMode: snapshot.context.darkMode,
    containerClasses: snapshot.context.darkMode
      ? "p-4 bg-gray-800 text-white border rounded-md mb-2"
      : "p-4 bg-gray-100 text-black border rounded-md mb-2",
  }),
  events: (event) => ({
    toggled: event<{ isDark: boolean }>(),
  }),
  commands: ({ actor }) => ({
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
  view: ({ snapshot }) => ({ /* same mapping as shared */ }),
  events: (event) => ({ toggled: event<{ isDark: boolean }>() }),
  commands: ({ actor }) => ({ /* same commands as shared */ }),
  effects: ({ snapshot, prevSnapshot, emit }) => {
    /* same effects as shared */
  },
});
```

Every registered component receives the merged facade values: the projected values from `view(...)`, the command helpers from `commands(...)`, and the underlying `state`/`send` utilities from the adapter.

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

- `view(...)` for projected render/runtime data
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
  view: ({ snapshot }) => ({
    count: snapshot.context.count,
    stateLabel: matchState(snapshot, { active: "Active" }, "Active"),
  }),
  commands: ({ actor, command }) => ({
    increment: () => actor.send({ type: "ADD", amount: 1 }),
    setLimit: command(
      (limit: number) => actor.send({ type: "SET_LIMIT", limit }),
      {
        description: "Set maximum count",
        input: command.number({ minimum: 3, maximum: 12 }),
      },
    ),
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
apiShowcase.getSchema();
apiShowcase.getSnapshot();
apiShowcase.getView();

apiShowcase.on("api-count-changed", (event) => [
  event.count,
  event.previousCount,
  event.state,
]);
apiShowcase.watchSnapshot((snapshot, prevSnapshot) => [prevSnapshot, snapshot]);
apiShowcase.watchView((view, prevView) => [prevView, view]);

const result = await apiShowcase.execute("increment");

const story = apiShowcase.record("reaches limit");
await story.execute("setLimit", 6);
await story.until((view) => view.isLimited, async () => {
  await story.execute("increment");
});
story.trace();
story.lifecycle();
story.summary();
story.stop();
```

The example also exposes the same runtime on `window.__igniteExamples.apiShowcase` so browser automation can prove the contract directly:

```ts
const runtime = window.__igniteExamples?.apiShowcase;
const story = runtime?.record("browser proof");

await story?.until((view) => view.isLimited, async () => {
  await story.execute("increment");
});
story?.trace();
story?.lifecycle();
```

---

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

If you need one stylesheet injected into every component shadow root, `ignite.config.ts` shows one advanced compatibility option:

```ts
import { defineIgniteConfig } from "ignite-renderer";

export default defineIgniteConfig({
  styles: new URL("./dist/styles.css", import.meta.url).href,
});
```

That `ignite.config.ts` file is reference-only in this example. The demo stays config-free unless you choose to import that module yourself or restore the config-loader/plugin wiring that used to load it automatically.

The example Vite config is only there to alias this monorepo workspace into local source files. It does not need a config-loader plugin for the default Ignite JSX flow.

---

## Tips & Next Steps

- **Shared vs. isolated**: pass a running actor for shared state, or a machine for isolated instances. ignite-element figures it out for you.
- **Facade composition**: keep expensive selectors inside `view(...)`; it runs against the adapter snapshot and feeds both renderers and the headless runtime view.
- **Registration shape**: prefer `component("element-name", (args) => view)` so every example reads the same way across XState, Redux, and MobX.
- **Experiment**: extend the machine with additional states or actions, expose them through the `commands` facade, and render them in a new component.

## More

- Docs: [ignite-element.dev](https://ignite-element.dev)
- Live playground: [StackBlitz demo](https://stackblitz.com/edit/ignite-element?file=src%2Fmy-counter.tsx)

Enjoy exploring ignite-element with XState! If you run into issues, file a ticket on the main repository or share feedback in the discussions tab.
