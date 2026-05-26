# Styling Defaults

The default v3 styling path is component-local CSS inside the JSX render output.

## Component-local `<style>` tags

```tsx
/** @jsxImportSource ignite-element/jsx */
const cardCss = `
  :host { display: block; }
  .card { padding: 1rem; border-radius: 0.75rem; }
`;

({ title }) => (
  <>
    <style>{cardCss}</style>
    <section className="card">{title}</section>
  </>
);
```

This keeps structure and styling together, works without `ignite.config.ts`, and lets the JSX renderer preserve the same `<style>` node across ordinary rerenders instead of duplicating it.

If your bundler can import CSS as text, you can replace `cardCss` with that imported string. If it cannot, keep the CSS string in a `.ts` module or inline constant.

## Shared shadow-root styles

Use `setGlobalStyles(...)` or `defineIgniteConfig({ styles })` only when you want one stylesheet injected into every component shadow root.

```ts
import { defineIgniteConfig } from "ignite-element";

export default defineIgniteConfig({
  styles: new URL("./theme.css", import.meta.url).href,
});
```

Treat this as an advanced compatibility path for shared themes, not the default authoring flow.

## CSS variables across shadow boundaries

Prefer CSS custom properties for host-app theming:

```css
:host {
  --card-bg: white;
}

.card {
  background: var(--card-bg);
}
```

Host pages can then set `--card-bg` outside the shadow root without rewriting component markup.

## CSP note

Inline `<style>` tags can conflict with strict `style-src` CSP settings. If your host app forbids inline styles, use shared stylesheet URLs through `styles`/`setGlobalStyles(...)` or a bundler flow that emits external CSS files.

## Light-DOM page styles

Keep page-shell layout and typography in your app entry stylesheet or `index.html`. Ignite’s shared `styles` setting is scoped to component shadow roots and does not style the host page.
