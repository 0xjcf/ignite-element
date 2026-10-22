---
"ignite-element": patch
"@ignite-element/renderer": patch
---

JSX omits a `script` element that has text children, and never assigns `__proto__`, `constructor`, or `prototype`. The executable-URL denylist now covers `srcset` (each candidate), `poster`, `background`, `cite`, and `ping` (each token). Untrusted style drops `url()`. `safeUrl`, `safeSpread`, and `trustedStyle` are the public helpers. `safeSpread` omits spread `on*` functions unless `handlers` names that exact key. A direct `onClick` function still registers. A `style` element stays, including ordinary component CSS. Untrusted style text drops `url()`, including a `url(` split across children. `trustedStyle` keeps `url(`.
