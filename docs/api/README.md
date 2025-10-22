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
| `states` | `(snapshot) => Record<string, unknown>` | Derive façade data from the adapter snapshot. Runs once per adapter instance. |
| `commands` | `(actor) => Record<string, (...args: any[]) => unknown>` | Expose imperative helpers bound to the adapter’s command actor (dispatch/send/store). |

### Returns

`(tag: string, renderer: ComponentRenderer) => void`

- `ComponentRenderer` can be a function, an object with `render(args)`, or a class whose instances implement `render(args)`.
- Render args merge the original adapter state/metadata with the derived façade values.
- TypeScript infers the render argument shape from the callbacks you provide—no extra helper types required.

## `igniteElementFactory(createAdapter, options?)`

Lower-level factory used by `igniteCore`. Accepts a callback that returns an adapter and optional configuration:

- `scope`: force `StateScope.Shared` or `StateScope.Isolated` when auto-detection is not desired.
- `createAdditionalArgs(adapter)`: supply extra props that should always appear in render arguments.

It returns a `(tag, renderer)` function identical to the one from `igniteCore`.

## Styling Helpers

- `setGlobalStyles(href: string)`: injects a stylesheet once and reuses it across components.
- `injectStyles(element: HTMLElement, css: string)`: for advanced use-cases requiring manual style injection.

## Roadmap

- [x] Adapter inference for XState, Redux, and MobX sources.
- [x] Facade callbacks for derived state and command helpers.
- [ ] JSX-friendly wrappers for React/Preact.
- [ ] JSX-friendly wrappers for Solid.
- [ ] `ignite.config.(ts|js)` for centralised styling defaults.

For the full acceptance criteria and future enhancements, see [`plans/ACCEPTANCE_CRITERIA.md`](../../plans/ACCEPTANCE_CRITERIA.md).
