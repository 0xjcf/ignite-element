---
"ignite-element": minor
"@ignite-element/renderer": minor
"@ignite-element/jsx-plugin": minor
---

Breaking, inside 3.0.0. This is not a 4.0. `trustedStyle`, `safeUrl`, and `safeSpread` are not public exports of `ignite-element/jsx` or `@ignite-element/renderer/jsx`. This beta has not been published with those names.

If you imported them:

- Delete the imports.
- Put loader CSS in a static `<style>` child, a same-file const, or `import sheet from "./sheet.css?raw"`.
- Put a color, length, or keyword that comes from props in a CSS custom property. Keep `url()` in the static sheet.
- Do not spread an untrusted object into JSX when that object can carry a handler, `text`, or `relList`. The renderer drops `text`, `relList`, and string handlers. A function on a direct prop still runs, including when that prop arrived by spread.
- Add `@ignite-element/jsx-plugin` once, in the bundler config. The package is native ESM-only: it has no `require` condition and no CommonJS build. Component files stay plain JSX. Vite is `igniteJsx()` from `@ignite-element/jsx-plugin/vite`. The same factory has Rollup, webpack, Rspack, esbuild, and Rolldown entry points. `./babel` and `./typescript` are not standalone and are not enough on their own. On their own they fail the build: the private import they emit does not resolve, and the failure says they are not enough on their own. They do not load the author mark by themselves. A bundler plugin is what marks `<style>` and wires the mark.

`javascript:` and the other rejected URL schemes are still dropped by the internal allowlist. Untrusted `style={}` still drops `url()`, `@import`, and the scriptable tokens. A global `defineIgniteConfig({ styles })` link is unchanged and is not how a component keeps a `url()`.

JSX omits a `script` whose local name is `script`, including a prefix such as `x:script` and SVG `script`, when it has text or element children or any own spelling of `src`, `href`, or `xlink:href`. The key's presence is enough: `false`, `null`, `undefined`, `""`, and `0` omit the element. A `link` whose `rel` contains `stylesheet`, `preload`, `modulepreload`, or `import` is omitted. `text` and `relList` are ignored on every element. A string `onclick` is not applied. A direct `onClick` function still runs, and so does a function inside a spread.

Without the plugin, a `<style>` load is dropped. Development warns that the plugin may be off. Production drops it silently. A marked sheet keeps `url()`, `@import`, `image-set(`, and a backslash, and still drops `expression(`, `behavior`, `-moz-binding`, and a `</style` breakout. A second copy of the author-style module fails closed. Do not import a helper to bless CSS. `ignite-element/jsx/author-style` is not a public export, and the plugin rejects a hand-written import of that target. Only a `const` or a `*.css?raw` import that is never reassigned is marked. A `let`, a `var`, and a `const` alias of either stay data. Mixing marked and unmarked children in one `<style>` drops the author `url()`.
