# ignite-element + React (framework interop)

A React 19 demo that consumes an ignite custom element through the schema-driven
`igniteReact` wrapper — the differentiated interop story: ignite *gives* you an
idiomatic, typed React component instead of making you hand-write one.

## What it shows

- **One-line wrapper.** `igniteReact(counterElement)` (in `counter.react.ts`)
  turns the registered ignite element handle into a typed `forwardRef` React
  component. No hand-written element interface, no JSX module augmentation, no
  scattered refs/listeners in app code.
- **Props in.** The single-arg `setLabel` command maps to a `label?: string`
  prop, set as the element's `label` attribute (mirrors
  `inferObservedAttributes`).
- **Events out.** The element's `countChanged` event becomes an
  `onCountChanged?: (event: { count: number }) => void` callback prop receiving
  the flat payload (`event.detail` forwarded directly — no envelope).
- **Commands via ref.** The ref is a typed `CommandHandle`
  (`increment()`, `decrement()`, `setLabel(label)`) bound to the element's
  methods. Type a `useRef` with `IgniteReactRef<typeof counterElement>` (exported
  as `CounterRef`) — no hand-written shape, no drift from the element's commands.

## Files

| File | Role |
| --- | --- |
| `src/counter.ignite.tsx` | The framework-neutral ignite element, authored as usual; registration returns a typed handle (`counterElement`). The view is authored with ignite-JSX — the config-free default renderer — via a per-file `@jsxImportSource` pragma. No React here. |
| `src/counter.react.ts` | The React binding: `igniteReact(counterElement)` is the whole wrapper, plus `CounterRef` (`IgniteReactRef<typeof counterElement>`). The element stays neutral; this is the React side of the boundary. |
| `src/App.tsx` | Idiomatic React, a pure consumer: imports `Counter`/`CounterRef`; props, ref, and events flow through them. |
| `src/main.tsx` | React root. |
| `index.html` | Host page + demo styling. |

## Run

```bash
cd src/examples/frameworks/react
pnpm install --ignore-workspace --no-link-workspace-packages
pnpm run dev
```

The Vite config aliases `ignite-element`, `ignite-element/react`, and the
`@ignite-element/*` workspace packages to local **source** so the demo always
runs against current code. `xstate` is pinned to the workspace version
(`5.32.1`) to avoid a dual-copy state-library skew.

## Why schema-driven (not hand-rolled)

A hand-rolled wrapper works today but pays a per-element tax: a hand-written
element interface, JSX declaration, event wiring, and ref plumbing kept in sync
by hand — and it does not scale across four frameworks. `igniteReact` reuses the
`getSchema()` metadata ignite already emits for agents, so the same handle drives
Vue/Svelte/Angular wrappers as follow-ups. See the
[host app integration guide](../../../../../../docs/site/src/content/docs/guides/host-app-integration.mdx)
for both paths.
