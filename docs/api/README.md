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
| `states` | `(snapshot) => Record<string, unknown>` | Derive render- and headless-facing data from the native adapter snapshot. Optional; omission returns one stable empty object. |
| `commands` | `({ actor, command, host }) => Record<string, (...args: any[]) => unknown>` | Expose imperative helpers from the command context. Use `actor` for adapter dispatch/send/store access, `command` to attach command contract metadata, and `host` for host-aware commands. |
| `cleanup` | `boolean` | Defaults to `true`. Shared adapter teardown override. When `false`, keeps shared adapters alive after the last element disconnects so the host can release them manually. |

### Returns

`(tag: string, renderer: ComponentRenderer) => void`

- `ComponentRenderer` can be a function, an object with `render(args)`, or a class whose instances implement `render(args)`.
- Public `igniteCore` render args contain derived states, semantic commands, and explicitly supported component facilities. They do not expose raw `state` or `send`.
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
  effects: ({ emit, select }) => {
    const isOn = select((snapshot) => snapshot.matches("on"));
    if (!isOn.changed) return;
    emit({ type: "toggled", isOn: isOn.current });
  },
});

const seen: Array<{ type: "toggled"; isOn: boolean }> = [];
const subscription = component.on("toggled", (event) => {
  seen.push(event);
});

const result = await component.execute({ command: "toggle" });

subscription.unsubscribe();

expect(result.snapshot.value).toBe("on");
expect(result.states).toEqual({});
expect(result.events).toEqual([
  { type: "toggled", isOn: true },
]);
expect(seen).toEqual([{ type: "toggled", isOn: true }]);
```

Use `execute()` for command-driven assertions, `on(...)` for emitted events, and `watchSnapshot(...)` or `watchStates(...)` when a test needs to observe longer-lived snapshots or projection changes.

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
