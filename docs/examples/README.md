# Examples Overview

Ignite-Element ships with three state-management examples that double as integration tests:

| Path | State Library | Highlights |
| --- | --- | --- |
| [`src/examples/xstate`](../../src/examples/xstate) | XState | Shared actor vs. isolated machine, Tailwind styling, gradient tally renderer |
| [`src/examples/redux`](../../src/examples/redux) | Redux Toolkit | Store factory vs. shared store instance, Bootstrap UI, facade commands |
| [`src/examples/mobx`](../../src/examples/mobx) | MobX | Observable reuse vs. factory isolation, theme variables, component-specific CSS |

Each example now relies on adapter inference—`igniteCore` detects the correct adapter from the `source` you provide. Shared sources (running actors, store instances, observables) produce shared scopes, while definitions (machines, slices, factories) yield isolated scopes.

> All examples also ship an `ignite.config.ts` so Ignite JSX is selected by default and global styles load automatically. Switch the `renderer` field to `"lit"` if you want to compare strategies while browsing the demos.

## Running the Examples

```bash
pnpm run examples:xstate
pnpm run examples:redux
pnpm run examples:mobx
```

Open the local URL shown in the terminal to explore the registered custom elements. The README in each example directory explains the layout, styling approach, and façade helpers used.

## Suggested Experiments

- Extend the facades with additional derived values and verify they flow into the renderers.
- Swap between shared and isolated sources to see how scope changes affect component state.
- Prototype custom renderer classes/objects to reuse presentation logic across multiple components.

For more details about the façade API and adapter behaviour, see the main project README or the API notes in [`docs/api`](../api/README.md).
