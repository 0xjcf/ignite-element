# ignite-element Public API Notes

This document summarises the stable public APIs exposed by `ignite-element`. It complements the inline TypeScript declarations and the example applications.

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

## Advanced renderer config

The stable `ignite-element` v3 path does not require `ignite.config.ts`. Use advanced `ignite-renderer` config only for shared shadow-root styles, renderer diagnostics, strategy overrides, or legacy `lit` compatibility:

```ts
import { defineIgniteConfig } from "ignite-renderer";

export default defineIgniteConfig({
  styles: new URL("./styles.css", import.meta.url).href,
  renderer: "lit",
  strategy: "diff",
  logging: "warn",
});
```

- `styles` injects shared shadow-root styles when the module is imported.
- `renderer` selects the advanced renderer. Supplying `"lit"` switches to the legacy template literal strategy.
- `strategy` is reserved for renderer strategy selection (diff vs replace) when multiple Ignite JSX strategies are available.
- `logging` controls renderer/config debug output (`"off"` | `"warn"` | `"debug"`).

Bundler config plugins and direct renderer imports are legacy compatibility paths, not stable `ignite-element` APIs.

## Roadmap

- [x] Adapter inference for XState, Redux, and MobX sources.
- [x] Facade callbacks for derived state and command helpers.
- [x] Ignite JSX renderer strategy and tooling.
- [x] Component-local `<style>` tags as the default styling path.

For end-to-end examples and testing guidance, see [`docs/testing.md`](../testing.md) and [`packages/ignite-element/README.md`](../../packages/ignite-element/README.md).
