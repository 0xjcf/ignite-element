# Styling Strategies

Ignite-element supports multiple styling approaches so you can match the needs of each component library:

## Global Styles

Use `setGlobalStyles(href)` to load a stylesheet once and reuse it across every component instance.

```ts
import { setGlobalStyles } from "ignite-element";

const href = new URL("./styles.css", import.meta.url).href;
setGlobalStyles(href);
```

## Scoped Styles

Add `<style>` or `<link>` nodes inside your render function when you need per-component CSS. The MobX example demonstrates linking an additional stylesheet for a single component.

## Dynamic Styles

Because renderers receive fully derived façade data, you can compute inline styles based on state:

```ts
({ count }) => html`
  <div style=${`opacity: ${(count + 1) / 10}`}></div>
`
```

## Roadmap

- [x] Global style helper (`setGlobalStyles`).
- [ ] Centralised configuration file (`ignite.config.ts`) for global defaults.
- [ ] Optional renderer wrappers for React/Solid to share styling conventions.

Refer back to [`README.md`](../../README.md#🎨-styling-options) for a quick summary and to the state-library examples for end-to-end implementations.
