---
"ignite-element": minor
"@ignite-element/renderer": minor
---

JSX omits a `script` whose local name is `script`, including a prefix such as `x:script` and SVG `script`, when it has text or element children or any spelling of `src`, `href`, or `xlink:href`. A `link` whose `rel` contains `stylesheet`, including an array or a `toString` value, is omitted. A `text` prop is not applied on `script`. The renderer never assigns `__proto__`, `constructor`, or `prototype`. Guarded URL attributes use the `safeUrl` allowlist (`http`, `https`, `mailto`, `tel`, and scheme-less strings that are not protocol-relative). That covers `srcset` (HTML candidates), `poster`, `background`, `cite`, and `ping` (each token). `xlinkHref` is written as `xlink:href`. `dangerouslySetInnerHTML` is not applied.

Untrusted style, in any ASCII case of the prop and for a prefixed `style` element, drops `url(` (including a comment before the paren), `@import`, `image-set(`, `-webkit-image-set(`, `src(`, `expression(`, a `behavior` token, `-moz-binding`, and any declaration that contains `\`. The `;` split ignores quotes and comments. `trustedStyle` keeps those loads and is a legal JSX child. `safeUrl` refuses `//host`, `\\host`, and `/\host`. `safeSpread` copies data keys such as `one` and `online`, drops real event-handler keys unless `handlers` names that exact key, and drops source-bearing keys such as `text` and `innerHTML`. A direct `onClick` function still registers.
