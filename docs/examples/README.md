# Examples Overview

Ignite-Element ships with adapter demos and worked-app examples that double as
integration tests:

| Path | Focus | Highlights |
| --- | --- | --- |
| [`examples/adapters/xstate`](../../examples/adapters/xstate) | XState | Shared actor vs. isolated machine, Tailwind styling, gradient tally renderer |
| [`examples/adapters/redux`](../../examples/adapters/redux) | Redux Toolkit | Store factory vs. shared store instance, Bootstrap UI, facade commands |
| [`examples/adapters/mobx`](../../examples/adapters/mobx) | MobX | Observable reuse vs. factory isolation, theme variables, component-specific CSS |
| [`examples/apps/spa-router`](../../examples/apps/spa-router) | Routing | History routing, dynamic params, auth guards, and headless route assertions |
| [`examples/apps/form-with-validation`](../../examples/apps/form-with-validation) | Forms | XState form validation, guarded submit, async success/error path, and headless form tests |
| [`examples/apps/nested-child-router`](../../examples/apps/nested-child-router) | Nested routing | Parent route plus child outlets projecting one shared actor |
| [`examples/apps/dashboard-with-shared-state`](../../examples/apps/dashboard-with-shared-state) | Shared state | Independent dashboard widgets coordinated through one consumer-owned source |

Each example now uses the v3 public adapter entrypoints: `ignite-element/xstate`, `ignite-element/redux`, and `ignite-element/mobx`. `igniteCore` detects the correct scope from the `source` you provide. Shared sources (running actors, store instances, observables) produce shared scopes, while definitions (machines, slices, factories) yield isolated scopes.

Examples project UI-facing data through `view(...)`; `commands(...)` exposes intent helpers, and the original `state`/`send` adapter utilities remain available to renderers. The XState example also exposes `record(...)` so the Playwright proof can drive behavior traces and DOM lifecycle evidence from the same story object.

> The examples include `ignite.config.ts` only as an advanced compatibility layer for demo-wide shared styles. The normal v3 public path is adapter entrypoint + `jsxImportSource: "ignite-element/jsx"` + component-local `<style>` tags.

## Running the adapter examples

```bash
pnpm run examples:xstate
pnpm run examples:redux
pnpm run examples:mobx
```

Open the local URL shown in the terminal to explore the registered custom
elements. The README in each example directory explains the layout, styling
approach, and facade helpers used.

## Running worked apps

Top-level examples are self-contained packages, not pnpm workspace members. Run
one directly from its directory:

```bash
cd examples/apps/nested-child-router
pnpm install --ignore-workspace
pnpm run dev
```

If workspace linking needs to stay disabled, configure
`linkWorkspacePackages: false` in `pnpm-workspace.yaml`.

Use the same shape for `spa-router`, `form-with-validation`, and
`dashboard-with-shared-state`.

## Suggested Experiments

- Extend the facades with additional derived values and verify they flow into the renderers.
- Swap between shared and isolated sources to see how scope changes affect component state.
- Register elements with `component("element-name", (args) => view)` so examples stay consistent across state libraries.

For more details about the facade API and adapter behaviour, see the main project README or the API notes in [`docs/api`](../api/README.md).
