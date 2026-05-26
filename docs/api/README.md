# ignite-element API Notes

This document summarises the key runtime and typing APIs exposed by ignite-element. It complements the inline TypeScript declarations and the example applications.

## `igniteCore(options)`

Creates a registration function for wiring adapters to custom elements.

### Required Options

| Option | Type | Description |
| --- | --- | --- |
| `source` | State library source (machine, actor, slice, store, observable, factory) | Determines the adapter and whether state is shared or isolated. Inference covers XState, Redux Toolkit, and MobX. |

### Optional Options

| Option | Type | Description |
| --- | --- | --- |
| `view` | `({ snapshot }) => Record<string, unknown>` | Derive render-facing data from the adapter snapshot. Runs when the runtime attaches and after later state updates. |
| `states` | `(snapshot) => Record<string, unknown>` | Supported alias for derived render-facing data. Prefer `view` for new components; keep `states` when maintaining existing components that already use it. |
| `commands` | `({ actor, command, host }) => Record<string, (...args: any[]) => unknown>` | Expose imperative helpers from the command context. Use `actor` for adapter dispatch/send/store access, `command` to attach command contract metadata, and `host` for host-aware commands. |
| `cleanup` | `boolean` | Defaults to `true`. Shared adapter teardown override. When `false`, keeps shared adapters alive after the last element disconnects so the host can release them manually. |

### Returns

`(tag: string, renderer: ComponentRenderer) => void`

- `ComponentRenderer` can be a function, an object with `render(args)`, or a class whose instances implement `render(args)`.
- Render args merge the original adapter state/metadata with the derived façade values.
- TypeScript infers the render argument shape from the callbacks you provide—no extra helper types required.

### Headless testing

`igniteCore(...)` also returns a headless runtime for deterministic testing and automation:

```ts
import { igniteCore } from "ignite-element/xstate";

const component = igniteCore({
  source: machine,
  commands: ({ actor }) => ({
    toggle: () => actor.send({ type: "TOGGLE" }),
  }),
  events: (event) => ({
    toggled: event<{ isOn: boolean }>(),
  }),
  effects: (_snapshot, _prevSnapshot, { emit, select }) => {
    const isOn = select((snapshot) => snapshot.matches("on"));
    if (!isOn.changed) return;
    emit("toggled", { isOn: isOn.current });
  },
});

const seen: Array<{ isOn: boolean }> = [];
const subscription = component.on("toggled", (event) => {
  seen.push(event.detail);
});

const result = await component.execute("toggle");

subscription.unsubscribe();

expect(result.state.value).toBe("on");
expect(result.events).toEqual([
  { type: "toggled", payload: { isOn: true } },
]);
expect(seen).toEqual([{ isOn: true }]);
```

Use `execute()` for command-driven assertions, `on(...)` for emitted events, and `watch(...)` or `watchView(...)` when a test needs to observe longer-lived state or projection changes.

## `igniteElementFactory(createAdapter, options?)`

Lower-level factory used by `igniteCore`. Accepts a callback that returns an adapter and optional configuration:

- `scope`: force `StateScope.Shared` or `StateScope.Isolated` when auto-detection is not desired.
- `createAdditionalArgs(adapter)`: supply extra props that should always appear in render arguments.
- `cleanup`: defaults to `true`. When enabled, shared adapters are reference-counted and released once the last element disconnects. Set to `false` if you want to manage shared adapter teardown manually.

It returns a `(tag, renderer)` function identical to the one from `igniteCore`.

## `defineIgniteConfig(config)`

Registers application-wide defaults at module evaluation time. Typical usage lives in `ignite.config.ts`:

```ts
import { defineIgniteConfig } from "ignite-element";

export default defineIgniteConfig({
 styles: new URL("./styles.css", import.meta.url).href, // formerly globalStyles
 renderer: "ignite-jsx", // or "lit"
 strategy: "diff", // optional, selects the diffing renderer once available
 logging: "warn", // optional: "off" | "warn" | "debug"
});
```

- `styles` mirrors `setGlobalStyles` but runs once when the module is imported. `globalStyles` remains as a deprecated alias.
- `renderer` selects the default renderer (`"ignite-jsx"` by default). Supplying `"lit"` switches back to the template literal strategy. Per-component overrides are still possible via the factory `createRenderStrategy` option.
- `strategy` is reserved for renderer strategy selection (diff vs replace) when multiple Ignite JSX strategies are available.
- `logging` controls renderer/config debug output (`"off"` | `"warn"` | `"debug"`).

Bundler plugins (`igniteConfigVitePlugin`, `IgniteConfigWebpackPlugin`) are available to auto-import the config file when present.

## Styling Helpers

- `setGlobalStyles(href: string)`: injects a stylesheet once and reuses it across components.
- `injectStyles(element: HTMLElement, css: string)`: for advanced use-cases requiring manual style injection.

## Roadmap

- [x] Adapter inference for XState, Redux, and MobX sources.
- [x] Facade callbacks for derived state and command helpers.
- [x] Ignite JSX renderer strategy and tooling.
- [x] `ignite.config.(ts|js)` for centralised styling defaults.

For end-to-end examples and testing guidance, see [`docs/testing.md`](../testing.md) and [`packages/ignite-element/README.md`](../../packages/ignite-element/README.md).
