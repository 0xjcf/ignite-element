# Styling Strategies

Ignite-element supports multiple styling approaches so you can match the needs of each component library:

## Global Styles

Use `setGlobalStyles(href)` to load a stylesheet once and reuse it across every component instance.

```ts
import { setGlobalStyles } from "ignite-element";

const href = new URL("./styles.css", import.meta.url).href;
setGlobalStyles(href);
```

### Centralised Configuration

Create an `ignite.config.ts` file and register it with `defineIgniteConfig` to configure global styles (and future defaults) once per application. The helpers automatically call `setGlobalStyles` under the hood.

```ts
// ignite.config.ts
import { defineIgniteConfig } from "ignite-element";

export default defineIgniteConfig({
	globalStyles: new URL("./styles.css", import.meta.url).href,
});
```

Import this module once in your entry file or rely on the provided bundler plugins to inject it automatically.

## Scoped Styles

Add `<style>` or `<link>` nodes inside your render function when you need per-component CSS. The MobX example demonstrates linking an additional stylesheet for a single component.

## Dynamic Styles

Because renderers receive fully derived façade data, you can compute inline styles based on state:

```tsx
/** @jsxImportSource ignite-element/jsx */
({ count }) => (
  <div style={{ opacity: (count + 1) / 10 }} />
)
```

## Roadmap

- [x] Global style helper (`setGlobalStyles`).
- [x] Centralised configuration file (`ignite.config.ts`) for global defaults.
- [ ] Document Ignite JSX renderer styling conventions and best practices.

Refer back to [`README.md`](../../README.md#🎨-styling-options) for a quick summary and to the state-library examples for end-to-end implementations.
