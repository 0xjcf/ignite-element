# JSX renderer threat model

**NEEDS JOSE approval.** This is the first written threat model for the JSX renderer. The rules are `04-rules.md`.

There is no SSR path. This package does not serialize HTML on the server, so there is no SSR/DOM parity to check. The promise below is the DOM renderer only.

## Promise

For the supported cases below, the renderer will not:

- parse a child string as HTML
- create a `script` element whose local name is `script` (any ASCII case, with or without a prefix such as `x:script`) when it has text or element children
- apply a `text` prop on a `script` element
- apply a remote CSS load from untrusted `style` text, a style attribute, or a style object, in any ASCII case of the prop key, including a prefixed `style` element. The loads are `url(`, `@import`, `image-set(`, `-webkit-image-set(`, `src(`, and any declaration that contains `\`. A load split across text children is included. `\` is not decoded
- assign `__proto__`, `constructor`, or `prototype`
- write a guarded URL attribute whose stripped scheme is on the denylist, including each `srcset` candidate from the HTML candidate parser and each `ping` token. The JSX denylist also blocks `data:text/xml`, `data:application/xml`, and a `data:` type ending in `+xml`. `xlinkHref` is the same sink as `xlink:href`
- register a function handler that arrived through `safeSpread` unless that exact key was allowed
- log the rejected URL, CSS, or script source

Direct `onClick={fn}` still runs. That is application code, not a spread of untrusted props.

`safeUrl` is an allowlist, not a denylist. After the same ASCII strip as the URL guard, it returns the original string when there is no scheme or the scheme is `http`, `https`, `mailto`, or `tel`. No scheme includes a path, a query, a hash, and, today, `//host`. `\\host` and `/\host` have no scheme match either, so they pass too. Whether that should change is NEEDS JOSE. Verifier reproduced `//evil.com` unchanged and wants it rejected. This model does not decide that.

## Supported

- Intrinsic HTML and SVG tags created by `jsx` / `jsxs` / `jsxDEV`, including a prefixed local name for `script` and `style`.
- Children that are strings, numbers, booleans, null, arrays, fragments, function components, or `trustedStyle`.
- URL props named in XSS-URL, in any ASCII case.
- Style strings, style objects, and `trustedStyle`, in any ASCII case of the `style` key.
- `safeUrl` and `safeSpread` at the call site.
- The bans on `innerHTML`, `outerHTML`, `innerText`, `outerText`, `textContent`, `srcdoc`, and `dangerouslySetInnerHTML`. `safeSpread` also drops `text`.

`trustedStyle` brands the string with `Symbol.for("ignite-element.trustedStyle")`. Code in the same realm can forge that symbol. JSON cannot.

## Unsupported, and the guarantee there

Unsupported input is not sanitized into something safe. The renderer still keeps the promises that do not depend on understanding that input:

- It still will not assign the three forbidden keys.
- It still will not parse children as HTML.
- It still will not write a guarded URL that fails the denylist when the value is a string.

It does not promise the result is inert when:

- A host `mount` assigns `innerHTML` or inserts nodes itself. That callback is the existing escape hatch for trusted markup.
- A custom element setter runs on some other property and navigates or writes markup.
- Application code changes the DOM after commit.
- A `script` has a `src` and no text or element children. The URL denylist still applies to `src`. An `https` script still loads.
- A `link` `href` passes the URL denylist. `rel=stylesheet` is not special. An `https` stylesheet from props still loads. `@import` and `image-set` inside untrusted style text are filtered. A stylesheet link is not.
- The caller does not use `safeSpread` and passes a function handler as a direct prop.
- The caller does not use `safeUrl` and passes `blob:` or `data:image/png`. The denylist allows those.
- Projection documents read model data. Their URI key list is not this slice.

CSP is the next slice. This model does not promise a Content-Security-Policy header or Trusted Types enforcement.
