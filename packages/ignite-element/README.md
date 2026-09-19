# Ignite Element

Connect a state source to Web Components, React, or headless consumers.

**source → source-native snapshot → states → view**

This documentation covers **v3 (beta)**.
Stable `ignite-element@latest` is v2.2.2; use the [v2 archive](https://0xjcf.github.io/ignite-element/2.x/)
for stable applications.

## Quick start

```sh
pnpm add ignite-element@beta xstate
```

Save as `src/light-switch.tsx` in a web project with TypeScript/JSX support:

```tsx
/** @jsxImportSource ignite-element/jsx */
import { igniteCore } from "ignite-element/xstate";
import { assign, createMachine } from "xstate";

const toggleMachine = createMachine(
  {
    context: { count: 0 },
    initial: "off",
    states: {
      off: { on: { FLIP: { target: "on", actions: "countFlip" } } },
      on: { on: { FLIP: { target: "off", actions: "countFlip" } } },
    },
  },
  {
    actions: {
      countFlip: assign({ count: ({ context }) => context.count + 1 }),
    },
  },
);

export const core = igniteCore({
  source: toggleMachine,
  states: (snapshot) => ({
    isOn: snapshot.matches("on"),
    label: snapshot.matches("on") ? "On" : "Off",
    count: snapshot.context.count,
  }),
  commands: ({ source }) => ({
    toggle: () => source.send({ type: "FLIP" }),
  }),
});

core("ignite-light-switch", (ctx) => (
  <section class="light-switch" data-state={ctx.label}>
    <link
      rel="stylesheet"
      href={new URL("./light-switch.css", import.meta.url).href}
    />
    <svg class="bulb" viewBox="0 0 64 80" aria-hidden="true">
      <path d="M22 56C22 46 10 44 10 28a22 22 0 0 1 44 0c0 16-12 18-12 28Z" />
      <path d="M23 64h18M26 72h12" />
    </svg>
    <p class="state">{ctx.label}</p>
    <p class="count">Toggled: {ctx.count}</p>
    <button
      type="button"
      role="switch"
      aria-label="Light"
      aria-checked={String(ctx.isOn)}
      onClick={() => ctx.toggle()}
    >
      <span class="track" aria-hidden="true">
        <span class="thumb" />
      </span>
      Flip
    </button>
  </section>
));
```

Load that file from your HTML entry and add `<ignite-light-switch></ignite-light-switch>`.
The [Getting started](https://0xjcf.github.io/ignite-element/#build-a-component) includes
the matching `src/light-switch.css`, complete HTML, live demo and complete example download. Inline `states` and `commands` preserve
inference; the view uses `ctx`. Each element has its own state: Ignite creates
and manages a private actor from `toggleMachine`.

## React and React Native

Use `const ctx = useIgnite(core)` from `ignite-element/react`. Render `ctx.count`
and call `ctx.increment()` or `ctx.decrement()` without mirrored React state.
See the [complete React example](https://github.com/0xjcf/ignite-element/tree/beta/examples/frameworks/react)
and [Views](https://0xjcf.github.io/ignite-element/handbook/views/).
`igniteReact(handle)` from `/react/web` is the separate browser custom-element recipe.

## Handbook

- [Getting started](https://0xjcf.github.io/ignite-element/)
- [Sources](https://0xjcf.github.io/ignite-element/handbook/sources/)
- [Views](https://0xjcf.github.io/ignite-element/handbook/views/)
- [Events & effects](https://0xjcf.github.io/ignite-element/handbook/events/)
- [Ownership & cleanup](https://0xjcf.github.io/ignite-element/handbook/ownership/)
- [Testing](https://0xjcf.github.io/ignite-element/handbook/testing/)
- [API reference](https://0xjcf.github.io/ignite-element/handbook/api/)
- [Examples](https://0xjcf.github.io/ignite-element/handbook/examples/)

Events and effects are optional. `core.dispose()` is terminal, including
after registration, and releases Ignite resources without shutting down borrowed
sources. Root `igniteCore()` is the source-free registrar only.

v3 is native ESM-only. Install only your chosen source peers; Lit is optional.
See [compatibility](https://0xjcf.github.io/ignite-element/api/compatibility/) for
the known NodeNext declaration limitation and tested platform boundaries.

## Contributing and support

[Contributing](https://github.com/0xjcf/ignite-element/blob/beta/CONTRIBUTING.md) ·
[Issues](https://github.com/0xjcf/ignite-element/issues) ·
[Discussions](https://github.com/0xjcf/ignite-element/discussions) ·
[MIT license](https://github.com/0xjcf/ignite-element/blob/beta/LICENSE)
