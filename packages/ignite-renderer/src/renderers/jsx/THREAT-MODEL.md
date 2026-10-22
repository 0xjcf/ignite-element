# JSX renderer threat model

Jose approved this model on 2026-10-22. The chat that day recorded it as "Approve THREAT-MODEL.md". The same note, and the cap quotes, are in `APPROVAL.md`. The rules are `04-rules.md`.

There is no SSR path. This package does not serialize HTML on the server, so there is no SSR/DOM parity to check. The promise below is the DOM renderer only.

## Promise

For the supported cases below, the renderer will not:

- parse a child string as HTML
- create a `script` element whose local name is `script` (any ASCII case, with or without a prefix such as `x:script`, including SVG `script`) when it has text or element children, or when any spelling of `src`, `href`, or `xlink:href` is present
- create a `link` element whose local name is `link` when any `rel` or `relList` spelling contains a `stylesheet`, `preload`, `modulepreload`, or `import` token, including an array or a `toString` value, in any ASCII case or prefix. `preload` is omitted for every `as` value. After props are applied, a `link` whose local name is `link`, including a prefix, loses `rel` and `href` when `relList` or, if `relList` is missing, the `rel` attribute contains any of those tokens. `prefetch`, `dns-prefetch`, `preconnect`, `prerender`, and `icon` are not in that list: an `https` href on those links is written
- apply a `text` prop on a `script` element
- apply a remote CSS load, `expression(`, a `behavior` token, or `-moz-binding` from untrusted `style` text, a style attribute, or a style object, in any ASCII case of the prop key, including a prefixed `style` element. The loads are `url(` (including a comment before the paren), `@import`, `image-set(`, `-webkit-image-set(`, `src(`, and any declaration that contains `\`. A load split across text children is included. `\` is not decoded. A declaration or rule that contains a loader is dropped. A sibling rule in its own span stays, including when the only semicolon between them is inside a string, as in `.q{content:'a;b'} .q2{background:url(...)}`. The splitter also breaks on `{` outside quotes and comments. A dropped declaration closes the blocks it owed before the next kept rule, so that rule is not pulled inside the dropped block. A selector whose declarations were all dropped stays as an empty rule, such as `a{}`. A semicolon goes between kept declarations and not after `{` or `}`, because a semicolon after `}` drops every later rule. One loader does not erase a sibling rule that the splitter can separate on `{`, `;`, or `}` outside quotes and comments
- assign `__proto__`, `constructor`, or `prototype`
- write a guarded URL attribute that `safeUrl` rejects. Allowed values are `http`, `https`, `mailto`, `tel`, and scheme-less strings that are not protocol-relative (`//`, `\\`, `/\`, `\/`). Each `srcset` and `imagesrcset` candidate from the HTML candidate parser, each `ping` token, and `manifest` are checked the same way. `xlinkHref` is the same sink as `xlink:href`. `data:` is refused, including `data:image/png` and `data:image/svg+xml`, except a raster `data:image/png`, `jpeg`, `jpg`, `gif`, `webp`, or `avif` value on `img` or `source` `src`, `srcset`, or `imagesrcset`. An `iframe`, `frame`, or `embed` `src`, and an `object` `data`, that is `http:` or `https:` is not written. A same-document path such as `/safe.txt` stays. A non-string SVG paint or SMIL value is dropped, so a `toString()` that changes between the check and the write cannot swap in a remote `url(`
- assign the URL property setters `host`, `hostname`, `protocol`, `port`, `pathname`, `origin`, `username`, `password`, `search`, or `hash`. They are skipped before the property write, and `safeSpread` drops them. Re-checking `href` with `safeUrl` does not stop `{ href: "/x", host: "evil.example" }`, because the rewritten `http://evil.example/x` is an allowed scheme
- apply a remote paint on SVG `fill`, `stroke`, `filter`, `mask`, `clip-path`, `marker`, `marker-start`, `marker-mid`, `marker-end`, or `cursor`, or on `from`, `to`, `by`, or `values` of `animate`, `set`, or `animateMotion`. The check is the untrusted-CSS loader check, so `u\rl(`, `\75 rl(`, `image-set(`, `src(`, `@import`, and `\` are dropped, not only a literal `url(`. The only paint that skips that check is a whole value of `url(#id)`, `url("#id")`, or `url('#id')`, where `id` has no whitespace, quote, or parenthesis. A remote `url(` inside or beside that form is dropped. `safeSpread` also drops `relList`
- treat `object` `archive` and `classid`, `embed` `code` and `pluginspage`, or `param` `value` as a navigation. An `http:` or `https:` URL on those attributes is written. Chrome does not load them. `object` `codebase` is a guarded URL key, so `javascript:` is dropped and an `https:` value is written, which Chrome also does not load
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
