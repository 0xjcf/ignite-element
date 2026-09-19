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

This keeps structure and styling together.

The JSX renderer preserves the same `<style>` node across ordinary rerenders instead of duplicating it.

If your bundler can import CSS as text, you can replace `cardCss` with that imported string. If it cannot, keep the CSS string in a `.ts` module or inline constant.

## Reuse a stylesheet

Link the same stylesheet inside each component's shadow root, as shown in the
[light switch](https://0xjcf.github.io/ignite-element/#build-a-component).

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

Inline `<style>` tags can conflict with strict `style-src` CSP settings. If your host app forbids inline styles, link an external stylesheet from the component, as the light-switch example does.

## Light-DOM page styles

Keep page-shell layout and typography in your app entry stylesheet or `index.html`. Styles inside a component shadow root do not style the host page.
