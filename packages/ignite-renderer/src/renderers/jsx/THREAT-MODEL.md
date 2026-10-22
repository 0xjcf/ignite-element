# JSX renderer threat model

**NEEDS JOSE approval.** This is the first written threat model for the JSX renderer. The rules are `04-rules.md`.

## Promise

For the supported cases below, the renderer will not:

- parse a child string as HTML
- create a `script` element that has text children
- apply `url(` from untrusted `style` text or a style attribute, including a `url(` split across text children
- assign `__proto__`, `constructor`, or `prototype`
- write a guarded URL attribute whose stripped scheme is on the denylist, including each `srcset` candidate and each `ping` token
- apply `url(` in untrusted style
- register a function handler that arrived through `safeSpread` unless that exact key was allowed
- log the rejected URL, CSS, or script source

Direct `onClick={fn}` still runs. That is application code, not a spread of untrusted props.

## Supported

- Intrinsic HTML and SVG tags created by `jsx` / `jsxs` / `jsxDEV`.
- Children that are strings, numbers, booleans, null, arrays, fragments, function components, or `trustedStyle`.
- URL props named in XSS-URL, in any ASCII case.
- Style strings, style objects, and `trustedStyle`.
- `safeUrl` and `safeSpread` at the call site.
- The existing bans on `innerHTML`, `outerHTML`, `innerText`, `outerText`, `textContent`, and `srcdoc`.

## Unsupported, and the guarantee there

Unsupported input is not sanitized into something safe. The renderer still keeps the promises that do not depend on understanding that input:

- It still will not assign the three forbidden keys.
- It still will not parse children as HTML.
- It still will not write a guarded URL that fails the denylist when the value is a string.

It does not promise the result is inert when:

- A host `mount` assigns `innerHTML` or inserts nodes itself. That callback is the existing escape hatch for trusted markup.
- A custom element setter runs on some other property and navigates or writes markup.
- Application code changes the DOM after commit.
- Style hides `url(` behind a CSS escape the string search does not decode.
- A `script` has a `src` and no text. The URL denylist still applies to `src`. A `https` script still loads.
- The caller does not use `safeSpread` and passes a function handler as a direct prop.
- The caller does not use `safeUrl` and passes `blob:` or `data:image/png`. The denylist allows those.
- Projection documents read model data. Their URI key list is not this slice.

CSP is the next slice. This model does not promise a Content-Security-Policy header or Trusted Types enforcement.
