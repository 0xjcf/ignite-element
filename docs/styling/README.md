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

Repeat the same CSS string in each component's `<style>` element, as the example above does. The [light switch](https://0xjcf.github.io/ignite-element/#build-a-component) uses that `<style>` element.

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

Inline `<style>` tags can conflict with strict `style-src` CSP settings. The renderer omits stylesheet links, so a strict host policy has to allow the component `<style>` element from the example above (a nonce or a hash).

## Custom style setters

A custom element's `style` setter receives a plain object of checked declarations. Write each own entry as a `key:value` declaration, for example `setProperty(key, value)` or a `cssText` string of `key:value` pairs. A `trustedStyle` value must be a complete CSS value, not a partial token. A duplicate install of `ignite-element` drops trusted styles (it fails closed across copies). Import `trustedStyle` from `ignite-element/jsx`. The copy on `@ignite-element/renderer` has its own registry, so a value from that import is dropped. Joining the values alone can rebuild a loader from a trusted fragment next to an untrusted neighbour (`trustedStyle("url")` beside `"(//evil)"`).

## Light-DOM page styles

Keep page-shell layout and typography in your app entry stylesheet or `index.html`. Styles inside a component shadow root do not style the host page.
