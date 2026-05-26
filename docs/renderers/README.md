# Renderer Defaults

Ignite Element ships with Ignite JSX as the default renderer. The normal v3 path is:

1. Set `jsxImportSource` to `ignite-element/jsx`.
2. Return JSX from your component render function.
3. Co-locate any component CSS with ordinary `<style>` tags.

No `ignite.config.ts` file or bundler plugin is required for that path.

## Default JSX path

```tsx
/** @jsxImportSource ignite-element/jsx */
component("ignite-counter", ({ count, increment }) => (
  <>
    <style>{`.counter { display: grid; gap: 0.5rem; }`}</style>
    <div className="counter">
      <button onClick={increment}>+</button>
      <span>{count}</span>
    </div>
  </>
));
```

The JSX renderer diffs ordinary rerenders by default, so stable nodes such as `<style>` tags are updated in place instead of being duplicated.

## Renderer compatibility

- `ignite-jsx` is the default and requires no extra registration through the public `ignite-element` entrypoints.
- `lit` remains supported for compatibility. Use it when you need to preserve existing lit templates.
- `ignite.config.ts`, `igniteConfigVitePlugin()`, and `IgniteConfigWebpackPlugin` stay available as advanced compatibility tools, not the default onboarding path.

Use config only when you need one of these project-wide overrides:

- shared shadow-root stylesheet injection
- renderer selection such as `renderer: "lit"`
- strategy/logging diagnostics for debugging

## Optional config path

```ts
import { defineIgniteConfig } from "ignite-element";

export default defineIgniteConfig({
  styles: new URL("./theme.css", import.meta.url).href,
  logging: "warn",
  // renderer: "lit",
  // strategy: "replace",
});
```

If you opt into `lit`, keep the config/plugin path or import `ignite-element/renderers/lit` yourself before registering components.

## Diff vs. replace

- Diffing is the default for Ignite JSX.
- Set `strategy: "replace"` only when you intentionally want legacy replace behavior.
- Per-host opt-outs such as `data-ignite-nodiff`, hydrated roots, or denylisted hosts remain supported as compatibility escape hatches.
