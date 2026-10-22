# Spike: ignite-jsx XSS

Spike only. Branch `spike/ignite-jsx-xss`, cut from `beta` `6ffb9bc`. Production code is unchanged. Gap tests use Vitest `it.fails`, so the spike suite exits 0 while the assertion still runs and fails.

Run:

```
pnpm --filter ignite-element exec vitest --config ../../experimental/ignite-jsx-xss/vitest.config.ts --run
```

This run: 33 passed. 22 are the safe contract. 11 are expected failures.

Chromium 143 was used once, outside the suite, to check script execution and CSSOM. The suite itself is jsdom.

## 1. `{}` expressions

Strings and numbers become text nodes (`packages/ignite-renderer/src/renderers/jsx/renderer.ts` 166–168, `createTextNode` at 1068). A string that looks like markup is text. Nested arrays are flattened (`normalizeChild` 158–160). A plain object is a comment (`ignite-unknown`), not `toString()` and not HTML.

`renders markup strings and nested arrays as text, and plain objects as comments` passed. No `img` was created from `"<img src=x onerror=alert(1)>"`.

**High.** A `<script>` string tag with a string child is still a script element whose text is the child. Chromium runs that pattern: `createElement("script")`, set `textContent`, append, and the script ran. The renderer uses those DOM calls. Trusted Types do not see `textContent`.

| | |
| --- | --- |
| Severity | high |
| Where | `renderer.ts` 1075–1083 (element plus text child), 1068 |
| Test | `a script element is not created for a string child` |
| Fix | Refuse the string tag `script`, or accept script children only from a branded token. |

Style text does not break out of the element. `does not parse style text as html` passed: `"</style><img …>"` stayed inside the style element.

## 2. HTML sinks

The JSX commit path does not assign `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or `document.write`. There is no raw-HTML escape hatch.

`isBlockedMarkupProp` (`renderer.ts` 385–397) refuses `innerHTML`, `outerHTML`, `innerText`, `outerText`, `textContent`, `srcdoc`, `length`, `options`, and `selectedOptions`, in any case. The commit loop drops them at 1166–1170. Types ban the same content props in `jsx-runtime.ts` 9–15 and `types.ts` 57–62. `createElement` copies props with `{ ...rawProps }` (`jsx-runtime.ts` 65) and does not filter names.

`packages/ignite-renderer/src/injectStyles.ts` 312 reads `linkElement.outerHTML` for a debug log. It is not a write, and it is not the JSX renderer.

`LitRenderStrategy.ts` 21 calls `lit-html` `render`, which assigns `template.innerHTML` (lit-html 3.3.2 `development/lit-html.js` 661) after `createPolicy("lit-html")` at line 69. That is the lit renderer, not ignite-jsx.

A TrustedHTML value passed as `innerHTML` is ignored along with strings. There is no writer to narrow. Adding one would be a new hatch. The proposal below does not add a writer. Script and style text are `textContent`, so Trusted Types would not cover them.

## 3. URL attributes

Guarded keys are `href`, `src`, `action`, `formaction`, and `xlink:href` (`packages/ignite-renderer/src/renderers/jsx/executableUri.ts` 4–7). `isBlockedUrlValue` (`renderer.ts` 465–507) also blocks every `<base href>`, `object` `data`, meta refresh, and SMIL `from` / `to` / `by` / `values` when the target is `href`. Non-strings on a guarded key are dropped. The checked string is the string that would be written.

The scheme check lowercases and strips U+0000–U+0020 and DEL, then matches `javascript:`, `vbscript:`, and `data:` of `text/html`, `image/svg+xml`, or `application/xhtml+xml`.

These passed:

- `drops href …` for case, leading space, tab, newline, NUL, `vbscript`, and the three `data:` types.
- `drops javascript and data urls on src, action, formaction, object data, and xlink:href`.
- `does not treat an entity-encoded scheme as a script url`. `href="&#106;avascript:alert(1)"` is stored as that literal. jsdom resolves it to an `http:` path. `setAttribute` does not decode entities. The URL parser does not treat it as `javascript:`.

The comment at `renderer.ts` 474–475 says `srcset` and `poster` are not checked. These attributes are written through as given.

| Gap | Severity | Where | Test |
| --- | --- | --- | --- |
| `srcset` keeps `javascript:` and `data:text/html` | medium | `executableUri.ts` 4–5, `renderer.ts` 474–475, assignment 1277–1283 | `srcset does not keep a javascript or data:text/html url` |
| `poster` keeps `javascript:` | medium | same | `poster does not keep a javascript or data:text/html url` |
| `background` keeps `javascript:` | medium | not in the key list | `background does not keep a javascript url` |
| `cite` keeps `javascript:` | medium | not in the key list | `cite does not keep a javascript url` |
| `ping` keeps `javascript:` | medium | not in the key list | `ping does not keep a javascript url` |

Fix: run the same scheme check for `srcset` (each candidate), `poster`, `background`, `cite`, `ping`, `longdesc`, and `usemap`.

## 4. String handlers and `srcdoc`

`isIgnoredHandlerAttribute` (`renderer.ts` 402–410) drops `on*` and `xlink:on*` before `setAttribute`. Functions are a separate path (`eventSlots` 1325–1331) and become `addEventListener`. String handlers are not listeners.

`does not apply string handler …` passed for `onclick`, `onClick`, `ONERROR`, `onfocus`, and `xlink:onclick`. `does not apply srcdoc` passed.

## 5. Prop spread

`{ ...rawProps }` copies own enumerable keys, including attacker keys. The commit loop then filters some of them.

`drops a javascript href, a string handler, and srcdoc from one object` passed. `Object.prototype` is not polluted by a JSON `"__proto__"` key (spread does not invoke the prototype setter on the props object).

**High.** The same key is later applied to the DOM node. `__proto__` is `in` the element, so `applyProperty` (`renderer.ts` 1277–1278) calls `Reflect.set` (`setContained` 1698–1703). That invokes the element’s `__proto__` setter. The node’s `localName` is then missing, and the next prop throws in `isBlockedUrlValue` at 473. The element is not appended, because props are patched before append. The render throws instead of ignoring the key. Dev mode also warns that `[object Object]` and `__proto__` are two spellings of one prop.

| | |
| --- | --- |
| Severity | high |
| Where | `jsx-runtime.ts` 65, `renderer.ts` 1277–1278, 1698–1703, throw at 473 |
| Test | `a spread __proto__ key does not throw or replace the element prototype` |
| Fix | Drop `__proto__`, `constructor`, and `prototype` before any property write. |

**Medium.** A spread function is a real listener. Author JSX uses that on purpose. An untrusted object can carry the same shape.

| | |
| --- | --- |
| Severity | medium |
| Where | `renderer.ts` 1325–1346 |
| Test | `a spread function handler is not registered` |
| Fix | A safe-spread helper copies an allowlist. Author `onClick={fn}` stays a direct prop. |

## 6. Style

`patchStyle` (`renderer.ts` 1288–1322) assigns a string with `cssText` and an object with `setProperty`. It does not parse the value. On Chromium 143 and in jsdom, `url(javascript:…)` and `expression(…)` are dropped by the CSS parser when set that way. `does not keep url(javascript:) or expression() on a style string or object` passed. The renderer has no filter of its own.

A normal `url(https://…)` is kept. That is CSS injection (tracking, overlay) from an untrusted string or object.

| Gap | Severity | Where | Test |
| --- | --- | --- | --- |
| Style string keeps `url(https://evil.example/leak)` | medium | `renderer.ts` 1319–1321 | `an untrusted style string cannot set a remote url` |
| Style object keeps the same | medium | `renderer.ts` 1302–1309 | `an untrusted style object cannot set a remote url` |
| `<style>` text is a live stylesheet | medium | text child at 1068, element at 1075–1083 | `a style element does not keep untrusted css text` |

Chromium applied `--xss: 1` from a style element created the same way, and left `url(javascript:…)` in `textContent`. HTML breakout from that text did not create elements.

Fix: reject `url(`, `expression(`, `behavior`, and `-moz-binding` in style strings and objects, or accept style only from a branded token. Refuse raw `<style>` children the same way as `<script>`, or require the branded token.

## Proposed API

Deny by default. Author JSX that passes a literal prop still works. Untrusted objects go through one helper.

```ts
type SafeUrl = string & { readonly __igniteSafeUrl: unique symbol };

function safeUrl(value: string): SafeUrl | null;
// https, http, mailto, tel, and same-document relative URLs.
// Reject javascript, vbscript, data text/html, data image/svg+xml,
// data application/xhtml+xml, after the same case and control-character strip.

function safeSpread(props: object): IgniteJsxProps;
// Copy own string and number attributes.
// Drop on*, srcdoc, innerHTML, outerHTML, __proto__, constructor, prototype.
// Run URL attributes, including srcset candidates, poster, background,
// cite, and ping, through safeUrl. Drop the attribute when it returns null.
// Drop style keys whose values contain url(, expression(, behavior, or -moz-binding.

type TrustedStyle = string & { readonly __igniteTrustedStyle: unique symbol };
function trustedStyle(value: string): TrustedStyle;
// The only string accepted as <style> children or as a raw style attribute.

type IgniteTrustedHtml = TrustedHTML & { readonly __igniteTrustedHtml: unique symbol };
// No DOM writer in this slice. String innerHTML stays ignored.
// A later hatch would accept this brand and nothing else, and would not
// accept a bare string.
```

`script` string tags are refused unless a separate explicit API exists. This sketch does not add that API.

## Open questions

- Refuse every `script` and `style` string tag, or only untrusted children? Author stylesheets in demos are string children today.
- `srcset` needs a candidate split (URL, then descriptors). One bad candidate should drop the attribute.
- `url(javascript:)` and `expression()` already die in Chromium’s CSSOM on element style. Do Firefox and WebKit keep them? An explicit reject still belongs on `<style>` text, where the raw string is stored.
- Function `on*` props are the event API. The spread helper is the boundary. Confirm that direct `onClick={fn}` must keep working.
- Entity decoding before the scheme check would change values that are inert today. Leave decoding out unless a path starts parsing HTML.
- A TrustedHTML writer is a new sink. The lit renderer already has one under the name `lit-html`.

## Rough size of a real slice

About **4 days**. Range **3–5 days**.

- Extend the URL guard to `srcset`, `poster`, `background`, `cite`, and `ping`, and keep the expected-fail tests as normal tests: 1 day.
- Drop `__proto__`, `constructor`, and `prototype` before `Reflect.set`: 0.5 day.
- `safeSpread` / `safeUrl` as the public deny-by-default entry: 1 day.
- Refuse `script` and raw `style` children, with a branded style token for demos that inject sheets: 1 day.
- Reject `url(`, `expression(`, `behavior`, and `-moz-binding` in `patchStyle`: 0.5 day.
