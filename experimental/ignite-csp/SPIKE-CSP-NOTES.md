# Spike: CSP by default

Spike only. Branch `spike/ignite-csp`, cut from `beta` `6ffb9bc`. Nothing here is wired into `packages/*`, and nothing here is a pull request.

The preset is the policy the demos were served under. Chromium 143 (Playwright 1.57, build 1200). Firefox and WebKit were not installed.

## Preset

`igniteContentSecurityPolicy(nonce)` returns:

```
script-src 'nonce-<nonce>' 'strict-dynamic'; object-src 'none'; base-uri 'none'; style-src 'self'; require-trusted-types-for 'script'; trusted-types ignite
```

No `'unsafe-inline'`. No `'unsafe-eval'`. The nonce is per response. `examples/adapters/xstate/index.html` ships three module scripts (lines 7–9) and a stylesheet link (line 6) with no nonce. The probe stamps the nonce onto parser `<script>` tags, including Vite's `/@vite/client`, then sets the header. Vite's `html.cspNonce` exists and is a single config string. A static nonce in the dev config is a different mechanism from a per-response nonce.

## What Chromium did with each style API

Served as `probes/matrix-page.ts` under the preset. Computed color is the evidence that a sheet applied.

| API | Directive reported | Applied |
| --- | --- | --- |
| `<link rel="stylesheet" href="/csp-matrix.css">` | none | `rgb(0, 128, 0)` |
| `<style>` text | `style-src-elem` | no (`rgb(0, 0, 0)`) |
| `<style nonce="…">` while the nonce is only on `script-src` | `style-src-elem` | no |
| `element.setAttribute("style", "color: red")` | `style-src-attr` | no |
| `element.style.cssText = "color: red"` | none | `rgb(255, 0, 0)` |
| `element.style.setProperty("color", "red")` | none | `rgb(255, 0, 0)` |
| `new CSSStyleSheet(); sheet.replaceSync(...); document.adoptedStyleSheets = [sheet]` | none | `rgb(255, 0, 0)` |
| `insertRule` and `sheet.replace` on a constructable sheet | none | sheet accepted, color not sampled |

A second header, `style-src 'self' 'nonce-…'`, lets the nonced `<style>` apply (`rgb(0, 0, 255)`) and still refuses a `<style>` with no nonce and a `style` attribute. `cssText` and `replaceSync` behave as in the table above. A nonce does not cover `style` attributes.

`packages/ignite-renderer` has no `adoptedStyleSheets` and no `CSSStyleSheet`. Styles enter three ways:

- JSX `<style>{css}</style>` becomes a real `<style>` element. Children are text nodes (`createTextNode` in `packages/ignite-renderer/src/renderers/jsx/renderer.ts`). Connecting that element is `style-src-elem`.
- A `style` prop, object or string, goes through `patchStyle` (`renderer.ts` 1288–1322): object values call `setProperty`, string values assign `cssText`. On this Chromium those writes apply under `style-src 'self'`.
- `packages/ignite-renderer/src/renderers/jsx/hosts.ts` line 436 assigns `style.cssText = VISUALLY_HIDDEN` for the accessible description span. Same CSSOM write as `patchStyle`. The xstate demo does not call `describe`, so that line did not fire in the demo probe.
- `injectStyles` (`packages/ignite-renderer/src/injectStyles.ts` 294–307) appends `<link rel="stylesheet">` and already copies `integrity` and `crossOrigin`. The `outerHTML` at line 312 is a debug read.

## Violations the strict probe reported

The gate is `xstate demo and example documents report no CSP or Trusted Types violations` in `probes/csp-audit.spec.ts`. It fails while any `securitypolicyviolation` or console CSP report is present. This run failed.

`my-counter-xstate` mounted. There was no `script-src` event and no Trusted Types event on the demo. The module graph loaded from the nonced parser scripts under `'strict-dynamic'`. The external `./dist/styles.css` link did not appear in the violation list.

### `style-src-elem`, blocked URI `inline`

Browser source for all seven demo events: `packages/ignite-renderer/src/renderers/jsx/renderer.ts:1043` (`patchChildren`, which inserts the element; `appendChild` is line 1052). Count 7. Console text: `Applying inline style violates the following Content Security Policy directive 'style-src 'self''`. Count 7.

Those elements are authored here:

| File | Line |
| --- | --- |
| `examples/adapters/xstate/xstateExample.tsx` | 55, 80, 91, 115, 127, 169 |
| `examples/adapters/xstate/xstateApiShowcase.tsx` | 14 |
| `examples/adapters/xstate/xstateAgentRuntimeShowcase.tsx` | 410 |

Parser `<style>` blocks, one event each, line number from the violation:

| File | Line |
| --- | --- |
| `examples/frameworks/react/index.html` | 7 |
| `examples/frameworks/svelte/index.html` | 7 |
| `examples/frameworks/vue/index.html` | 7 |
| `examples/apps/form-with-validation/index.html` | 7 |
| `examples/agents/voice-workbench/index.html` | 8 |

Same parser or shadow `<style>`, not served in this run: `examples/agents/smart-home/index.html:7`, `examples/agents/voice-workbench/parity.html:8`, `examples/frameworks/svelte/src/App.svelte:79`, `examples/frameworks/vue/src/App.vue:66`, `examples/agents/voice-workbench/src/workbench.tsx:14`, `examples/agents/voice-workbench/src/parity.tsx:261`, `examples/apps/form-with-validation/src/form.tsx:69` and `:87`, `examples/apps/spa-router/src/pages.tsx:40`, `examples/apps/spa-router/src/router.tsx:68`, `examples/apps/dashboard-with-shared-state/src/dashboard.tsx:41`, `:67`, `:103`, `:124`, `examples/apps/nested-child-router/src/router.tsx:91`, `:111`, `:125`, `:160`, `:191`, `examples/adapters/redux/src/js/reduxExample.tsx:88`, `:124`, `:131`.

### `style-src-attr`, blocked URI `inline`

Matrix only, from `setAttribute("style", …)`. The demo's `style={{…}}` and `style="…"` props go through `patchStyle`, and this Chromium did not report them. Sites exercised by the mounted demo and absent from the violation list:

| File | Line | Write |
| --- | --- | --- |
| `examples/adapters/xstate/xstateExample.tsx` | 118, 178 | object prop, string prop |
| `examples/adapters/xstate/xstateApiShowcase.tsx` | 42 | object prop |
| `examples/adapters/xstate/xstateAgentRuntimeShowcase.tsx` | 438, 447, 455, 463, 495, 518 | object props |

## Trusted Types

`require-trusted-types-for 'script'` plus `trusted-types ignite` did not fire on the xstate demo. The JSX renderer builds DOM with `createElement`, `createTextNode`, `setAttribute`, and `textContent`. Markup props are refused in `isBlockedMarkupProp` (`renderer.ts` 385–397): `innerHTML`, `outerHTML`, `innerText`, `outerText`, `textContent`, `srcdoc`, `length`, `options`, `selectedOptions`. Types ban `innerHTML` and `outerHTML` (`jsx-runtime.ts` 10–11, `types.ts` 58–59). String `on*` props are ignored (`renderer.ts` 1172–1176). `textContent` writes at `renderer.ts:969` and `hosts.ts:444` are plain text.

The matrix calls the sinks directly. Each throw is the browser message. `document.write` ran in an about:blank iframe: it threw `TrustedHTML` and the parent listener did not record a `securitypolicyviolation` for it.

| Sink | Directive | Result |
| --- | --- | --- |
| `innerHTML` | `require-trusted-types-for` | throws `TrustedHTML` |
| `outerHTML` | `require-trusted-types-for` | throws `TrustedHTML` |
| `insertAdjacentHTML` | `require-trusted-types-for` | throws `TrustedHTML` |
| `Range.createContextualFragment` | `require-trusted-types-for` | throws `TrustedHTML` |
| `iframe.srcdoc` | `require-trusted-types-for` | throws `TrustedHTML` |
| `document.write` | event not captured | throws `TrustedHTML` |
| `eval` | `require-trusted-types-for` | throws `EvalError` citing `script-src` and the missing `'unsafe-eval'` |
| `new Function` | `require-trusted-types-for` | same `EvalError` |
| `setTimeout("…")` | `require-trusted-types-for` | throws `TrustedScript` |
| `trustedTypes.createPolicy("lit-html", …)` | `trusted-types` | throws, policy name disallowed |
| `trustedTypes.createPolicy("ignite", { createHTML, createScript })` then `innerHTML = policy.createHTML("<b>ok</b>")` | none | assigns `<b>ok</b>` |
| `eval(policy.createScript("40+2"))` | `script-src` | throws `EvalError`. A `TrustedScript` does not satisfy `script-src` |

Library production source (`packages/*/src`, excluding tests) has no `insertAdjacentHTML`, `document.write`, `createContextualFragment`, `DOMParser`, `eval`, `new Function`, or string `setTimeout` / `setInterval`.

`innerHTML` / `outerHTML` assignments that do exist are tests, not the renderer:

| File | Line | What |
| --- | --- | --- |
| `packages/ignite-element/src/tests/IgniteCore.test.ts` | 202, 1637, 1780 | `document.body.innerHTML = ""` |
| `packages/ignite-element/src/tests/IgniteElementFactory.test.ts` | 107 | same |
| `packages/ignite-element/src/tests/IgniteRedux.test.tsx` | 27 | same |
| `packages/ignite-element/src/tests/attributeObservation.test.ts` | 11 | same |
| `packages/ignite-element/src/tests/createComponentFactory.test.ts` | 23 | same |
| `packages/ignite-element/src/tests/react/igniteReact.test.tsx` | 60 | same |
| `packages/ignite-element/src/tests/renderers/igniteJsxRenderStrategy.test.ts` | 29, 253 | same |
| `packages/ignite-element/src/tests/renderers/renderer.reconciliation.test.ts` | 806 | `root.innerHTML = "<slot></slot>"` |
| `packages/ignite-element/src/tests/tools-fail-closed.property.test.ts` | 1525, 1791, 1805, 1834, 2436 | `new Function` to load a published snippet |
| `scripts/__tests__/renderer-jsx-bundle.test.mjs` | 177, 178 | `window.eval` in the harness |

`packages/ignite-element/src/internal/projectionDocument.ts` lists `innerhtml`, `outerhtml`, and `srcdoc` in a field-name denylist (lines 44–64). That is not a DOM write.

Optional lit path: `packages/ignite-renderer/src/renderers/LitRenderStrategy.ts` line 21 calls `render(view, shadowRoot)` from `lit-html`. lit-html 3.3.2 (`development/lit-html.js`) creates policy `lit-html` at line 69 (`createHTML` returns the string) and assigns `template.innerHTML` at line 661. The string is wrapped with `policy.createHTML` at lines 349–351 when Trusted Types exist. The preset's `trusted-types ignite` refuses that policy name at import time. The xstate index page does not import lit-html. `examples/adapters/xstate/xstateTaskManager.ts` line 2 does, and that module is not on the probed page.

## Proposed API

Experimental exports from `experimental/ignite-csp/src/index.ts`:

```ts
igniteContentSecurityPolicy(nonce: string): string
IGNITE_CSP_HEADER // "Content-Security-Policy"
warnIfNoContentSecurityPolicy(): void
acknowledgeContentSecurityPolicy(): void
subresourceIntegrity(bytes: Uint8Array): string
```

The nonce must match `/^[A-Za-z0-9+/=_-]{8,128}$/` so it cannot break the header.

`warnIfNoContentSecurityPolicy` returns immediately unless `__IGNITE_DEV_WARNINGS__` is true, the same define as `configs/vite/devWarnings.ts`. It warns once. A `<meta http-equiv="Content-Security-Policy">` with content suppresses it. A header-only policy is invisible to script, so the host calls `acknowledgeContentSecurityPolicy()` after sending one. It is not invoked from render. The esbuild check in `src/preset.test.ts` bundles both calls with `__IGNITE_DEV_WARNINGS__` set to `false` and minifies. The output has no `document`, `console`, `querySelector`, warning text, or the flags. The same bundle with the define set to `true` keeps the warning and the meta query.

## SRI

`strict-dynamic` allows a module imported by a nonced entry. It does not hash the bytes. A CDN or unpkg URL inside that graph runs as the entry's script. Integrity has to be on the entry tag the browser fetches:

```html
<script type="module" src="https://unpkg.com/ignite-element@3.0.0-beta.18/dist/ignite-element.es.js"
  integrity="sha384-…" crossorigin="anonymous" nonce="…"></script>
```

`import()` has no integrity argument in current browsers. Hosted submodules need the same treatment as the entry, or they need to stay on the same origin as a nonced graph the operator built.

`injectStyles` already forwards `integrity` and `crossOrigin` onto the `<link>`. Script bundles do not publish a hash today.

A release can hash each `dist` file after the build:

```
openssl dgst -sha384 -binary dist/ignite-element.es.js | openssl base64 -A
```

`subresourceIntegrity` is that digest with a `sha384-` prefix. sha384 is 48 bytes, base64 length 64. Publish `dist/sri.json` next to the bundles (`{ "ignite-element.es.js": "sha384-…" }`) and copy the same tokens into the GitHub release body. The page that loads the CDN script reads the token for that exact file. A new build changes the token.

## Tests

Unit (`vitest`, 6 passed):

```
pnpm --filter ignite-element exec vitest --config ../../experimental/ignite-csp/vitest.config.ts --run
```

Browser (Playwright Chromium). The xstate example is not a workspace package. Install its deps once so `build:css` can run (`pnpm --dir examples/adapters/xstate install --ignore-workspace --no-link-workspace-packages`). The Playwright config runs `build:css` and then Vite on `127.0.0.1:8091`.

```
pnpm --filter ignite-element exec playwright test --config ../../experimental/ignite-csp/playwright.config.mjs
```

| Test | Result |
| --- | --- |
| `style and sink matrix matches the preset on Chromium` | passed |
| `matrix with a style nonce allows only the nonced style element` | passed |
| `xstate demo and example documents report no CSP or Trusted Types violations` | failed, 7 `style-src-elem` on the demo and 1 on each of the five documents above. No script or Trusted Types events on the demo |

The failing test is the gate. Its assertion stays empty. It is outside `pnpm test` and outside `.github/workflows/ci.yml` (that workflow runs on `main` pushes and on pull requests to `main` and `beta`).

## Open questions

- Firefox and WebKit. The Chromium result that `cssText` and `setProperty` apply under `style-src 'self'` may be this engine. The matrix page is the check. A real slice should not treat that result as the style design.
- Constructable stylesheets applied here with no `style-src` event. Confirm the same on the other two engines before moving shadow CSS onto `adoptedStyleSheets`.
- Whether `trusted-types` should also name `lit-html` when the optional lit renderer is loaded. The identity `createHTML` is lit's model. Adding the name makes that renderer load. Leaving it off keeps the allowlist to `ignite`.
- `document.write` in an iframe threw `TrustedHTML` without a captured `securitypolicyviolation`. Worth one more probe on the top document before calling the event list complete.
- The dev warning cannot see a header. `acknowledgeContentSecurityPolicy` is the hook. Whether the dev host should call it next to the existing `__IGNITE_DEV_WARNINGS__` setup is a one-line product choice.
- Per-response nonce belongs on the server that emits HTML. Vite's `html.cspNonce` does not set the CSP header.

## Rough size of a real slice

About **5 days**. Range **4–7 days**.

- Shadow CSS helper using `CSSStyleSheet.replaceSync` and `adoptedStyleSheets`, and the xstate demo moved onto it so the strict probe goes green: 2 days.
- The other example `<style>` sites in the table above, plus `hosts.ts` line 436 moved onto that sheet: 1–2 days.
- Lit policy name decision and a test that imports `LitRenderStrategy` under the preset: 0.5 day.
- Dev warning called once from the dev host, still behind `__IGNITE_DEV_WARNINGS__`: 0.5 day.
- Move the red probe into the package Playwright run after it is green, and emit `dist/sri.json` from the release build: 1 day.
