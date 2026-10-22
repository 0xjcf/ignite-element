---
"ignite-element": minor
"@ignite-element/renderer": minor
---

JSX omits a `script` whose local name is `script`, including a prefix such as `x:script`, when it has text or element children. A `text` prop is not applied on `script`. The renderer never assigns `__proto__`, `constructor`, or `prototype`. The executable-URL denylist covers `srcset` (HTML candidates, so a comma inside a `data:` URL stays), `poster`, `background`, `cite`, and `ping` (each token), plus `data:text/xml`, `data:application/xml`, and `data:` types ending in `+xml`. `xlinkHref` is written as `xlink:href` and uses that denylist. `dangerouslySetInnerHTML` is not applied.

Untrusted style, in any ASCII case of the prop and for a prefixed `style` element, drops `url(`, `@import`, `image-set(`, `-webkit-image-set(`, `src(`, and any declaration that contains `\`. The `;` split ignores quotes and comments. `trustedStyle` keeps those loads and is a legal JSX child. `safeUrl` is an allowlist for `http`, `https`, `mailto`, `tel`, and scheme-less strings, including `//host` until that choice is decided. `safeSpread` copies data keys such as `one` and `online`, drops real event-handler keys unless `handlers` names that exact key, and drops source-bearing keys such as `text` and `innerHTML`. A direct `onClick` function still registers.
