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

Add `@ignite-element/jsx-plugin` once in the bundler config. Babel-only and tsc-only setups need that bundler plugin. On their own they fail closed: the private import they emit does not resolve, and there is no public export that makes it resolve. A static `<style>` string, a same-file `const`, or `import sheet from "./sheet.css?raw"` is author CSS. A `let` or `var`, including one that is never written again, stays data, and so does a `const` that aliases one. A value from props stays data. There is no public import that marks CSS: `ignite-element/jsx/author-style` is not a package export, and a hand-written import is a build error. Mixing marked and unmarked CSS in one `<style>` drops the author `url()`.

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

A custom element's `style` setter receives a plain object of checked declarations. Write each own entry as a `key:value` declaration, for example `setProperty(key, value)` or a `cssText` string of `key:value` pairs. A static `<style>` string, a same-file const, or a `*.css?raw` default import is marked by the build plugin. Prop data uses a CSS custom property: put a color, length, or keyword in the variable and keep `url()` in the static sheet. A second installed copy fails closed, so its mark does not keep a load. Joining the values alone can rebuild a loader from neighbouring fragments (`"url"` beside `"(//evil)"`).

## Light-DOM page styles

Keep page-shell layout and typography in your app entry stylesheet or `index.html`. Styles inside a component shadow root do not style the host page.
