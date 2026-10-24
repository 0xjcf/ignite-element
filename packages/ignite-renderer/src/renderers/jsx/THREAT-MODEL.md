# JSX renderer threat model

Jose approved this model on 2026-10-22. The chat that day recorded it as "Approve THREAT-MODEL.md". The same note, and the cap quotes, are in `APPROVAL.md`. The rules are `04-rules.md`.

There is no SSR path. This package does not serialize HTML on the server, so there is no SSR/DOM parity to check. The promise below is the DOM renderer only.

## Promise

For the supported cases below, the renderer will not:

- parse a child string as HTML
- create a `script` element whose local name is `script` (any ASCII case, with or without a prefix such as `x:script`, including SVG `script`) when it has text or element children, or when any spelling of `src`, `href`, or `xlink:href` is present on an own key, including a namespaced key such as `svg:src` or `foo:xlink:href`, and including the values `false`, `null`, `undefined`, `""`, and `0`
- create a `link` element whose local name is `link` when any `rel` or `relList` spelling contains a `stylesheet`, `preload`, `modulepreload`, or `import` token, including an array or a `toString` value, in any ASCII case or prefix. `preload` is omitted for every `as` value. After props are applied, a `link` whose local name is `link`, including a prefix, loses `rel` and `href` when `relList` or, if `relList` is missing, the `rel` attribute contains any of those tokens. `prefetch`, `dns-prefetch`, `preconnect`, `prerender`, and `icon` are not in that list: an `https` href on those links is written. A `rel` or `relList` value is read once and that checked string is what would be written. `href` is not written when the checked value contains a blocked token
- apply a `text` prop on any element
- apply a remote CSS load, `expression(`, a `behavior` token, or `-moz-binding` from untrusted `style` text, a style attribute, or a style object, in any ASCII case of the prop key, including a prefixed `style` element. The loads are `url(` (including a comment before the paren), `@import`, `image-set(`, `-webkit-image-set(`, `src(`, and any declaration that contains `\`. A load split across text children is included. `\` is not decoded. A declaration or rule that contains a loader is dropped. A sibling rule in its own span stays, including when the only semicolon between them is inside a string, as in `.q{content:'a;b'} .q2{background:url(...)}`. The splitter also breaks on `{` outside quotes and comments. A dropped declaration closes the blocks it owed before the next kept rule, so that rule is not pulled inside the dropped block. A selector whose declarations were all dropped stays as an empty rule, such as `a{}`. A semicolon goes between kept declarations and not after `{` or `}`, because a semicolon after `}` drops every later rule. One loader does not erase a sibling rule that the splitter can separate on `{`, `;`, or `}` outside quotes and comments. A custom element's own `style` setter receives that filtered string. Each own enumerable value of a style object is read once and checked the same way, in any casing of its key. The setter receives a new plain object. A string entry is the primitive string that was checked. A number entry arrives as a string, so `{ opacity: 0 }` is `"0"`. A `null` entry stays `null`. An `undefined` entry is omitted. A loader value is omitted. A property name that contains a loader or `\` is omitted too. A property whose name and checked value join into a loader after comments are removed is omitted too. An inherited property is not copied, and a live `toString` is not passed through. `null`, `false`, and numbers, as the whole style value, are passed through unchanged. An author mark is not a style attribute: `url()` in `style={}` is dropped. A marked `<style>` sheet keeps author loads
- assign `__proto__`, `constructor`, or `prototype`
- write a guarded URL attribute that the internal allowlist rejects. Allowed values are `http`, `https`, `mailto`, `tel`, and scheme-less strings that are not protocol-relative (`//`, `\\`, `/\`, `\/`). Each `srcset` and `imagesrcset` candidate from the HTML candidate parser, each `ping` token, and `manifest` are checked the same way. `xlinkHref` is the same sink as `xlink:href`. `data:` is refused, including `data:image/png` and `data:image/svg+xml`, except a raster `data:image/png`, `jpeg`, `jpg`, `gif`, `webp`, or `avif` value on `img` or `source` `src`, `srcset`, or `imagesrcset`. An `iframe`, `frame`, or `embed` `src`, and an `object` `data`, that is `http:` or `https:` is not written. A same-document path such as `/safe.txt` stays. A non-string SVG paint or SMIL value is dropped, so a `toString()` that changes between the check and the write cannot swap in a remote `url(`
- assign the URL property setters `host`, `hostname`, `protocol`, `port`, `pathname`, `origin`, `username`, `password`, `search`, or `hash`. They are skipped before the property write. Re-checking `href` with the allowlist does not stop `{ href: "/x", host: "evil.example" }`, because the rewritten `http://evil.example/x` is an allowed scheme
- apply a remote paint on SVG `fill`, `stroke`, `filter`, `mask`, `clip-path`, `marker`, `marker-start`, `marker-mid`, `marker-end`, or `cursor`, or on `from`, `to`, `by`, or `values` of `animate`, `set`, or `animateMotion`. The check is the untrusted-CSS loader check, so `u\rl(`, `\75 rl(`, `image-set(`, `src(`, `@import`, and `\` are dropped, not only a literal `url(`. The only paint that skips that check is a whole value of `url(#id)`, `url("#id")`, or `url('#id')`, where `id` has no whitespace, quote, or parenthesis. A remote `url(` inside or beside that form is dropped. `relList` is skipped on every element
- treat `object` `archive` and `classid`, `embed` `code` and `pluginspage`, or `param` `value` as a navigation. An `http:` or `https:` URL on those attributes is written. Chrome does not load them. `object` `codebase` is a guarded URL key, so `javascript:` is dropped and an `https:` value is written, which Chrome also does not load
- tell a function that arrived by spread from a direct function prop. Both run. A string handler does not
- log the rejected URL, CSS, or script source

Direct `onClick={fn}` still runs. That is application code, not a spread of untrusted props.

The internal allowlist is what the renderer uses for guarded URL attributes. It is not a public export. After the same ASCII strip, it returns the original string when the scheme is `http`, `https`, `mailto`, or `tel`, or when there is no scheme and the value is not protocol-relative. It returns `null` for `//host`, `\\host`, `/\host`, `javascript:`, `data:`, `blob:`, and `ftp:`. It does not see a later `host` or `hostname` assignment. Those keys are not assigned. The raster `data:image` exception is applied by the renderer for `img` and `source` only. The allowlist itself still returns `null` for every `data:` string.

## Supported

- Intrinsic HTML and SVG tags created by `jsx` / `jsxs` / `jsxDEV`, including a prefixed local name for `script`, `style`, and `link`.
- Children that are strings, numbers, booleans, null, arrays, fragments, or function components.
- URL props named in XSS-URL, in any ASCII case, when the internal allowlist allows the string.
- Style strings and style objects, in any ASCII case of the `style` key. A marked `<style>` child keeps author `url()` and `@import`.
- The bans on `innerHTML`, `outerHTML`, `innerText`, `outerText`, `textContent`, `srcdoc`, and `dangerouslySetInnerHTML`. `text` and `relList` are skipped on every element.

The build marks author CSS with a module-local symbol and records the object it created. An application import is not a way to create that mark: `ignite-element/jsx/author-style` is not a package export, and the plugin rejects a hand-written import. A `let` or `var`, or a `const` that aliases one, is not marked. `Symbol.for("ignite-element.authorStyle")` is not that mark. A copied symbol is dropped as a `<style>` child and as a style value. A second copy of the module fails closed. A proxy that is not the recorded object contributes no CSS and does not throw. The mark keeps `url()`, `@import`, `image-set(`, `src(`, and `\` in a `<style>` sheet. It does not keep `expression(`, `behavior`, `-moz-binding`, or a `</style` breakout, and it does not keep a loader in `style={}`. A custom `style` setter must write `key:value` declarations. Joining values only can rebuild a loader from neighbouring fragments.

## Unsupported, and the guarantee there

Unsupported input is not sanitized into something safe. The renderer still keeps the promises that do not depend on understanding that input:

- It still will not assign the three forbidden keys.
- It still will not parse children as HTML.
- It still will not write a guarded URL that fails the internal allowlist when the value is a string.

It does not promise the result is inert when:

- A host `mount` assigns `innerHTML` or inserts nodes itself. That callback is the existing escape hatch for trusted markup.
- A custom element setter runs on some other property and navigates or writes markup.
- A custom `style` setter joins declaration values and drops the property names. `key:value` text does not rebuild a loader from a trusted fragment beside an untrusted neighbour. A values-only join can.
- Application code changes the DOM after commit.
- A direct `eval` of the bundled module can replace a marked binding after the plugin has run. The mark is a build-time fact about the source text. It is not a seal against a later `eval` in the same realm. Do not `eval` application code next to a marked sheet.
- A function handler passed as a direct prop still runs, and so does one inside a spread.
- Projection documents read model data. Their URI key list is not this slice. The projection denylist is unchanged.

CSP is the next slice. This model does not promise a Content-Security-Policy header or Trusted Types enforcement.
