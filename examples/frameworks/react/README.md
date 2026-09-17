# React views over a shared core

The primary demo uses `useIgnite(core)` from `ignite-element/react`. Both counters
read source-derived count and label through `ctx`, and call increment/decrement
and label commands directly. The source and core are created outside rendering.

From the repository root:

```sh
pnpm install
pnpm --dir examples/frameworks/react install \
  --ignore-workspace --no-link-workspace-packages
pnpm --dir examples/frameworks/react dev
```

Open the local URL printed by Vite. To build:

```sh
pnpm --dir examples/frameworks/react build
```

- [shared-counter.tsx](shared-counter.tsx): canonical source, inline projection and commands, hook views.
- [App.tsx](src/App.tsx): primary runnable screen.
- [WebInterop.tsx](src/WebInterop.tsx): explicitly optional `igniteReact(handle)` demo
  listening to an actual custom element. Its emitted count updates a React-owned
  odd/even status.

React files use React JSX; element registration files use the Ignite JSX pragma.
Repository aliases exercise local source. Installed applications use
`ignite-element@beta`, `xstate`, `react`, and `react-dom` through public imports.
The neutral hook also serves React Native with native controls; web wrappers do not.
`useIgnite(core)` automatically unsubscribes when a view unmounts. No cleanup
`useEffect` is needed in the view.

Dispose the core when its owning feature or session permanently discards it.
The external actor's owner stops it when nothing else needs it.
See the [session cleanup example](https://0xjcf.github.io/ignite-element/handbook/ownership/#end-a-session).

[Views handbook](https://0xjcf.github.io/ignite-element/handbook/views/)
