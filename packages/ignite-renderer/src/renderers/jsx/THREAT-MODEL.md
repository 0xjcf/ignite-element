# JSX renderer threat model

Jose approved this model on PR #180. The rules are `04-rules.md`.

There is no SSR path. This package does not serialize HTML on the server, so there is no SSR/DOM parity to check. The promise below is the DOM renderer only.

## Promise

For the supported cases below, the renderer will not:

- parse a child string as HTML
- create a `script` element whose local name is `script` (any ASCII case, with or without a prefix such as `x:script`, including SVG `script`) when it has text or element children, or when any spelling of `src`, `href`, or `xlink:href` is present
- create a `link` element whose local name is `link` when any `rel` or `relList` spelling contains a `stylesheet`, `preload`, `modulepreload`, or `import` token, including an array or a `toString` value, in any ASCII case or prefix. `preload` is omitted for every `as` value. After props are applied, a `link` whose reflected `relList` still contains `stylesheet` loses `rel` and `href`
- apply a `text` prop on a `script` element
- apply a remote CSS load, `expression(`, a `behavior` token, or `-moz-binding` from untrusted `style` text, a style attribute, or a style object, in any ASCII case of the prop key, including a prefixed `style` element. The loads are `url(` (including a comment before the paren), `@import`, `image-set(`, `-webkit-image-set(`, `src(`, and any declaration that contains `\`. A load split across text children is included. `\` is not decoded. A declaration or rule that contains a loader is dropped. A sibling rule in its own span stays, including when the only semicolon between them is inside a string, as in `.q{content:'a;b'} .q2{background:url(...)}`. Braces opened by a kept span are closed. A semicolon goes between kept declarations and not after `}`, because a semicolon there drops every later rule. A sheet that is a single span containing a loader becomes empty. One loader does not erase a sibling rule that the splitter can separate on `;` or `}` outside quotes and comments
- assign `__proto__`, `constructor`, or `prototype`
- write a guarded URL attribute that `safeUrl` rejects. Allowed values are `http`, `https`, `mailto`, `tel`, and scheme-less strings that are not protocol-relative (`//`, `\\`, `/\`, `\/`). Each `srcset` and `imagesrcset` candidate from the HTML candidate parser, each `ping` token, and `manifest` are checked the same way. `xlinkHref` is the same sink as `xlink:href`. `data:` is refused, including `data:image/png` and `data:image/svg+xml`, except a raster `data:image/png`, `jpeg`, `jpg`, `gif`, `webp`, or `avif` value on `img` or `source` `src`, `srcset`, or `imagesrcset`. An `iframe` or `frame` `src` that is `http:` or `https:` is not written. A same-document path such as `/safe.txt` on an iframe stays
- assign the URL property setters `host`, `hostname`, `protocol`, `port`, `pathname`, `origin`, `username`, `password`, `search`, or `hash`. They are skipped before the property write, and `safeSpread` drops them. Re-checking `href` with `safeUrl` does not stop `{ href: "/x", host: "evil.example" }`, because the rewritten `http://evil.example/x` is an allowed scheme
- apply a remote `url(` on SVG `fill`, `stroke`, `filter`, `mask`, `clip-path`, `marker`, `marker-start`, `marker-mid`, `marker-end`, or `cursor`, or on `from`, `to`, `by`, or `values` of `animate`, `set`, or `animateMotion`. `url(#fragment)` and `url("#id")` stay. `safeSpread` also drops `relList`
- register a function handler that arrived through `safeSpread` unless that exact key was allowed
- log the rejected URL, CSS, or script source

Direct `onClick={fn}` still runs. That is application code, not a spread of untrusted props.

`safeUrl` is the allowlist the renderer uses for guarded URL attributes. After the same ASCII strip, it returns the original string when the scheme is `http`, `https`, `mailto`, or `tel`, or when there is no scheme and the value is not protocol-relative. It returns `null` for `//host`, `\\host`, `/\host`, `javascript:`, `data:`, `blob:`, and `ftp:`. It does not see a later `host` or `hostname` assignment. Those keys are not assigned. The raster `data:image` exception is applied by the renderer for `img` and `source` only. `safeUrl` itself still returns `null` for every `data:` string.

## Supported

- Intrinsic HTML and SVG tags created by `jsx` / `jsxs` / `jsxDEV`, including a prefixed local name for `script`, `style`, and `link`.
- Children that are strings, numbers, booleans, null, arrays, fragments, function components, or `trustedStyle`.
- URL props named in XSS-URL, in any ASCII case, when `safeUrl` allows the string.
- Style strings, style objects, and `trustedStyle`, in any ASCII case of the `style` key.
- `safeUrl` and `safeSpread` at the call site.
- The bans on `innerHTML`, `outerHTML`, `innerText`, `outerText`, `textContent`, `srcdoc`, and `dangerouslySetInnerHTML`. `safeSpread` also drops `text`.

`trustedStyle` brands the string with `Symbol.for("ignite-element.trustedStyle")`. Code in the same realm can forge that symbol. JSON cannot. It is the way to keep a CSS load, a backslash, `expression(`, `behavior`, or `-moz-binding`.

## Unsupported, and the guarantee there

Unsupported input is not sanitized into something safe. The renderer still keeps the promises that do not depend on understanding that input:

- It still will not assign the three forbidden keys.
- It still will not parse children as HTML.
- It still will not write a guarded URL that fails `safeUrl` when the value is a string.

It does not promise the result is inert when:

- A host `mount` assigns `innerHTML` or inserts nodes itself. That callback is the existing escape hatch for trusted markup.
- A custom element setter runs on some other property and navigates or writes markup.
- Application code changes the DOM after commit.
- The caller does not use `safeSpread` and passes a function handler as a direct prop.
- Projection documents read model data. Their URI key list is not this slice. The projection denylist is unchanged.

CSP is the next slice. This model does not promise a Content-Security-Policy header or Trusted Types enforcement.
