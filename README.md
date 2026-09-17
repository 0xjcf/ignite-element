# Ignite Element

Connect a state source to Web Components, React, or headless consumers.

**source → source-native snapshot → states → view**

This branch contains the **unreleased command-context rename** to `commands({ source })`.
See the [migration note](docs/site/src/content/docs/migration/command-source.mdx) in the candidate docs.
The quick start below deliberately uses **published beta.14** and its `{ actor }` syntax.
Stable `ignite-element@latest` is v2.2.2; use the [v2 archive](https://0xjcf.github.io/ignite-element/2.x/)
for stable applications.

## Quick start

```sh
pnpm add ignite-element@3.0.0-beta.14 xstate
```

Save as `src/toggle.tsx` in a Vite/TypeScript project:

```tsx
/** @jsxImportSource ignite-element/jsx */
import { igniteCore } from "ignite-element/xstate";
import { createActor, createMachine } from "xstate";

const source = createActor(
  createMachine({
    initial: "off",
    states: {
      off: { on: { TOGGLE: "on" } },
      on: { on: { TOGGLE: "off" } },
    },
  }),
).start();

export const core = igniteCore({
  source,
  states: (snapshot) => ({ isOn: snapshot.matches("on") }),
  commands: ({ actor }) => ({
    toggle: () => actor.send({ type: "TOGGLE" }),
  }),
});

core("ignite-toggle", (ctx) => (
  <section>
    <button type="button" onClick={() => ctx.toggle()}>
      {ctx.isOn ? "On" : "Off"}
    </button>
  </section>
));

export function dispose() {
  try {
    core.dispose();
  } finally {
    source.stop();
  }
}
```

Load that file from your HTML entry and add `<ignite-toggle></ignite-toggle>`.
The [Getting started handbook](https://0xjcf.github.io/ignite-element/) includes
the complete HTML and run commands. Inline `states` and `commands` preserve
inference; the view uses `ctx`. The application owns final source shutdown.

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

Events/effects and Actor-Web are optional. `core.dispose()` is terminal, including
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
