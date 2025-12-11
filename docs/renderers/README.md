# Renderer Strategy & Ignite JSX Runtime

> **Status:** Planning document. Nothing here is public API yet.

Ignite Element ships with the Ignite JSX runtime by default. The goal of the renderer strategy work is to keep the core surface (`igniteCore`, adapter facades, component factory) intact while allowing other renderers—such as the optional lit strategy kept for compatibility/fallback—to plug in when desired.

## Objectives

- **Renderer-agnostic core:** `IgniteElement` must not assume `TemplateResult`. Rendering is delegated to a strategy object.
- **First-party JSX runtime:** Provide a lightweight Ignite JSX renderer (compiler + runtime) that converts JSX to DOM with no third-party dependencies.
- **Optional strategies:** Ignite JSX is the default strategy. The lit-html strategy stays available as the fallback/compat option and can be selected once via `ignite.config.ts`.
- **Diffing rollout:** Diffing is the default mode; `strategy` config is optional (omit for auto-diff). Use `strategy: "replace"` to force legacy behavior or per-component opt-out (`data-ignite-nodiff`/denylist). See `docs/renderers/diffing-rollout.md`.
- **Consistent ergonomics:** Registering components (function/object/class) keeps the same `states`/`commands` facade, regardless of renderer.
- **Tree-shakable:** When the JSX renderer isn’t used, its runtime should disappear from bundles.

## Architecture Overview

### 1. Renderer Strategy Interface

```ts
export interface RenderStrategy<State, Event, View> {
 attach(host: ShadowRoot): void;
 render(view: View): void;
 detach?(): void;
}
```

- `View` is strategy specific (`TemplateResult` for lit, `VNode` for Ignite JSX).
- Strategies own lifecycle hooks and can reuse shared utilities (e.g., `injectStyles`).

### 2. Refactoring `IgniteElement`

```ts
abstract class IgniteElement<State, Event, View> extends HTMLElement {
 constructor(
  protected readonly adapter: IgniteAdapter<State, Event>,
  private readonly strategy: RenderStrategy<State, Event, View>,
 ) {
  super();
  const shadow = this.attachShadow({ mode: "open" });
  this.strategy.attach(shadow);
  // subscribe to adapter, wire send(), etc.
 }

 protected renderWithStrategy(view: View) {
  this.strategy.render(view);
 }

 disconnectedCallback(): void {
  this.strategy.detach?.();
  // current teardown logic
 }
}
```

- The existing lit-specific `render()` call moves into `LitRenderStrategy`.
- Shared behaviour (state subscription, send, style injection contract) remains in the base class.

### 3. Strategy Implementations

| Strategy | Notes |
| --- | --- |
| `LitRenderStrategy` | wraps `lit-html`’s `render`, reuses `injectStyles`, matches current behaviour. |
| `IgniteJsxRenderStrategy` | consumes Ignite VNodes and efficiently patches DOM using a minimal diffing runtime (`h`, `Fragment`, keyed reconciliation), no external deps. |

Future strategies (e.g., framework adapters) could reuse the same shape, but aren’t required for v2.

### 4. Ignite JSX Runtime

Components author JSX that compiles to `h(type, props, ...children)`. Runtime responsibilities:

- Create/update DOM nodes with keyed diffing.
- Support functional renderers and class-style renderers (`render(args)`).
- Handle event props (`onClick`, etc.) and attribute/property updates.
- Provide `jsx`, `jsxDEV`, and `jsxs` factories so TypeScript/TSX works without additional tooling.

Example facade usage:

```tsx
/** @jsxImportSource ignite-element/jsx */
const register = igniteCore({
 source: counterStore,
 states: (snapshot) => ({ count: snapshot.count }),
 commands: ({ actor }) => ({ increment: () => actor.increment() }),
});

component("ignite-counter", ({ count, increment }) => (
 <div class="counter">
  <button onClick={increment}>+</button>
  <span>{count}</span>
 </div>
));
```

> The Ignite JSX compiler injects the necessary runtime helpers automatically (similar to Solid’s compile-time transform), so developers only author JSX. The `jsxImportSource` comment (or a project-level TS/Babel config) is the only hint required.

Supported renderer shapes mirror the lit strategy:

```tsx
// Function renderer
component("function-counter", ({ count }) => <span>{count}</span>);

// Object renderer
component("object-counter", {
  render: ({ count }) => <span>{count}</span>,
});

// Class renderer
class CounterView {
  render({ count }: { count: number }) {
    return <span>{count}</span>;
  }
}
component("class-counter", CounterView);
```

### 5. Factory & Config Integration

- `igniteElementFactory` still accepts a `renderStrategy` override when you need component-level control.
- Global defaults live in `ignite.config.ts`:

  ```ts
  import { defineIgniteConfig } from "ignite-element";

  export default defineIgniteConfig({
   renderer: "ignite-jsx", // can be omitted since Ignite JSX is the default
   styles: new URL("./styles.css", import.meta.url).href, // formerly globalStyles
   strategy: "diff", // opt into diffing renderer when available
   logging: "warn", // dev-time renderer/config logging
  });
  ```

  Set `renderer: "lit"` to opt into the lit strategy across the project. The config plugins import the lit entry automatically; if you’re skipping them, add `import "ignite-element/renderers/lit"` alongside your config.
  `globalStyles` is still accepted as a deprecated alias for `styles` during migration.
- When an unknown renderer is configured (or the strategy was never registered), ignite-element falls back to `"ignite-jsx"` and emits a warning.

## Migration Plan

1. **Implement strategy abstraction** in `IgniteElement` / `igniteElementFactory`.
2. **Build Lit strategy** (parity with existing behaviour).
3. **Implement Ignite JSX runtime** (h factory, diffing, hydration plan TBD).
4. **Create tests/examples** covering config-driven renderer selection and JSX rendering.
5. **Document the new workflow** (README, docs, migration guide).
6. **Feature flag** the Ignite JSX renderer initially so projects can opt in gradually.

## Open Questions

- Should we expose a compile-time Babel/TS transform, or rely on TypeScript’s `jsxImportSource` configuration?
- Do we need SSR output for Ignite JSX in v2, or can we defer until a later iteration?
- How do we surface dev-mode diagnostics (e.g., key mismatches) without bloating production bundles?
- Should per-component renderer overrides be publicly supported, or only the global config hook?

Keep this document updated as we implement the strategy abstraction and the Ignite JSX runtime.
