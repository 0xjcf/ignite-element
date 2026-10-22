# JSX XSS rules

Slice: close the XSS gaps from `spike/ignite-jsx-xss` (`2bc840b`) in the real JSX renderer.

Jose accepted that gap list as the scope. A rule that maps directly to it is accepted. Anything marked **NEEDS JOSE** is an extra rule or an open choice. It is not implemented unless the rule text says the code does it.

The threat model is `THREAT-MODEL.md` in this directory. Jose approved it on PR #180.

## Baseline

SLICE-1. One row per baseline id.

| Id | Status | Why | Enforced or tested |
| --- | --- | --- | --- |
| AUTH-1 | not applicable | This slice adds no principal, event, or capability table. It refuses untrusted markup in the view. | — |
| ACT-1 | not applicable | No irreversible actor arrow and no guard chain. | — |
| RPL-1 | not applicable | No signed request, challenge, or spent set. | — |
| RPL-2 | not applicable | The renderer does not read a clock and records no time. | — |
| LOG-1 | not applicable | No actor move. A development warning is not an audit trail. | — |
| LOG-2 | applies | A warning may name the prop key or the tag. It must not include the rejected URL, CSS text, script source, or handler body. | XSS-LOG. `jsxXss.test.ts` asserts a blocked URL warning does not contain the payload. |
| HW-1 | not applicable | No irreversible move and no hardware key. | — |
| HW-2 | not applicable | Nothing is signed and nothing is shown as a canonical payload. | — |
| UNT-1 | not applicable | No LLM client, prompt, or tool description. | — |
| UNT-2 | applies | Untrusted strings stay text. There is no HTML writer. URL and style checks refuse the listed dangerous values. | XSS-SCRIPT, XSS-URL, XSS-STYLE-URL, XSS-STYLE-ELEMENT, XSS-NO-HTML. `jsxXss.test.ts`. |
| SC-1 | not applicable | No credential, token, or agent secret. | — |
| SC-2 | not applicable | No new dependency. `fast-check` is already a dev dependency of `ignite-element`. | — |
| SC-3 | not applicable | No workflow or third-party action change. | — |
| SLICE-1 | applies | This table is the baseline section for the slice. | This file. |

## Accepted rules

### XSS-SCRIPT

A `script` element is omitted when its normalized children include any text node or any element. The tag match uses the local name after the last `:`, then ASCII case, so `script`, `SCRIPT`, and `x:script` are the same rule.

Text nodes come from string children, number children, and a component that returns either. An empty string is still a text node, so the element is omitted. Element children include a nested tag and a component that returns an element. Those children are not created either.

A `script` with a `src`, `href`, or `xlink:href` prop is omitted. Every spelling counts, so `src: false` does not hide `SRC`. That includes a prefixed tag such as `x:script` and an SVG `script`. Comment children (`null`, `true`, `false`) do not keep it. There is no trusted-script value. A `script` with none of those props and neither text nor element children is still created. A `text` prop on a `script` element is a source-bearing prop and is not applied, on mount or on update. `safeSpread` drops `text`, `textContent`, `innerText`, `outerText`, `innerHTML`, `outerHTML`, `srcdoc`, and `dangerouslySetInnerHTML`.

A `link` whose local name is `link` (any ASCII case, with or without a prefix) is omitted when any `rel` or `relList` spelling contains a `stylesheet`, `preload`, `modulepreload`, or `import` token. An array and a `toString` value count. `preload` is omitted for every `as` value. `rel: "icon"` does not hide `REL: "stylesheet"`. Other `link` elements, such as `rel=icon`, stay and their `href` uses XSS-URL. After props are applied, a `link` whose reflected `relList` contains `stylesheet` loses `rel` and `href`.

### XSS-PROTO

These keys are never written, on a spread or on a direct prop, because the renderer cannot tell those apart:

- `__proto__`
- `constructor`
- `prototype`

The match is the exact key, not a case fold. `__PROTO__` is not the special setter and is not this rule.

`setContained` returns before `Reflect.set` for these keys. Both prop loops skip them before `in`, before a URL check reads `localName`, and before `setAttribute`. `safeSpread` drops them too.

### XSS-URL

The shared projection denylist is unchanged. The JSX renderer does not use that denylist for attributes. A guarded string is written only when `safeUrl` allows it: after the same ASCII strip, the value is `http`, `https`, `mailto`, `tel`, or has no scheme and is not protocol-relative (`//`, `\\`, `/\`, `\/`). `javascript:`, `vbscript:`, `data:`, `blob:`, and `ftp:` are not written. `data:` stays refused, including `data:image/svg+xml` and `data:image/png` on anchors and other tags. The exception is a raster `data:image/png`, `jpeg`, `jpg`, `gif`, `webp`, or `avif` on `img` or `source` `src`, `srcset`, or `imagesrcset`. `safeUrl` itself still returns `null` for every `data:` string. An `iframe` or `frame` `src` of `http:` or `https:` is not written. A path such as `/safe.txt` stays. The keys `host`, `hostname`, `protocol`, `port`, `pathname`, `origin`, `username`, `password`, `search`, and `hash` are never assigned.

The prop key is lowercased, so `srcSet` is `srcset`. The guarded keys are:

- `href` (already guarded; `base` `href` stays unconditionally blocked)
- `src`
- `action`
- `formaction` (`formAction` is the same key)
- `xlink:href` (`xlinkHref` is the same sink and is written as `xlink:href`)
- `codebase`
- `data` on `object` only
- `srcset` on every element, including `img` and `source`
- `poster` on every element, including `video`
- `background` on every element, including `body`
- `cite` on every element, including `blockquote`, `q`, `del`, and `ins`
- `ping` on every element, including `a` and `area`
- `imagesrcset` on every element, including `link`
- `manifest` on every element, including `html`

`srcset` and `imagesrcset` use the HTML candidate parser. The URL is a run of non-whitespace. A comma inside that run stays in the URL, so `data:image/png;base64,…` is one candidate. A comma after the URL, including a URL that ends with a comma, separates candidates. Descriptors stay with their candidate. Each full candidate must pass `safeUrl`, so a scheme split by whitespace is still blocked and a descriptor such as `1x` stays glued on. If any candidate is blocked, the whole attribute is dropped. It is not rewritten into a shorter list. On `img` and `source`, a raster `data:image` candidate is kept. On every other element it is dropped. A candidate with no space, such as `https://cdn.example/a.png,javascript:alert(1)`, is one URL token whose scheme is `https`, and it is kept.

`ping` is blocked when the stripped whole value is dangerous, or when any token split on HTML whitespace (tab, line feed, form feed, carriage return, space) is dangerous. The whole-value check catches a scheme that hides a whitespace character. The token check catches a safe URL beside a dangerous one, which the strip would otherwise glue together. If either check fails, the whole attribute is dropped. A NUL inside one token is not a separator, so `java\u0000script:` is still one token and is blocked.

Non-string values on a guarded key are not applied. SMIL `from`, `to`, `by`, and `values` are still blocked when `attributeName` targets `href`. They are also blocked when the value contains a remote `url(`. `url(#fragment)` stays. The same remote-`url(` check applies to `fill`, `stroke`, `filter`, `mask`, `clip-path`, `marker`, `marker-start`, `marker-mid`, `marker-end`, and `cursor`. Meta refresh stays blocked.

### XSS-SPREAD

`safeSpread(props, options?)` copies enumerable own string keys, except the three XSS-PROTO keys, the source-bearing keys `text`, `textContent`, `innerText`, `outerText`, `innerHTML`, `outerHTML`, `srcdoc`, and `dangerouslySetInnerHTML`, the URL property setters (`host`, `hostname`, `protocol`, `port`, `pathname`, `origin`, `username`, `password`, `search`, `hash`), and `relList`. The match for those keys is ASCII case-insensitive.

A key is a handler key when it matches `/^on[A-Z]/`, or when its lowercase form is `on` plus a real event name. The name is real when `on` plus that name is on `HTMLElement`, `Window`, `Document`, `SVGElement`, `window`, or `document`, or when it is in the guard's list of names those objects do not expose, such as `begin` and `repeat`. `onClick`, `onclick`, `ONERROR`, and `ononline` are handler keys. `one`, `online`, and `onlyIcon` are not. `xlink:onclick` is not a handler key here; the renderer already drops that string attribute.

A handler key is copied only when the value is a function and `options.handlers` lists that exact key. `onClick` does not allow `onclick`. A string handler is never copied, even if the key is listed.

A direct JSX `onClick={fn}` does not go through `safeSpread` and still registers with `addEventListener`. The spike's `it.fails` passed `onClick` straight to `jsx` and expected silence. This rule follows the accepted API instead of removing direct handlers.

Other keys are copied as they are. The renderer still applies XSS-URL and the string-handler drop after `safeSpread`.

### XSS-STYLE-URL

Untrusted style loads no URL and runs no legacy scriptable property. The prop key match is ASCII case-insensitive, so `style`, `Style`, and `STYLE` are the same sink. The raw declaration is checked, and so is the declaration with comments removed, so `url/**/(` and `url /*c*/ (` are `url(`. A `/*` inside a string cannot hide a later `url(` or `expression(`, because the raw text still contains that token. The loader match is case-insensitive and allows whitespace before `(`. It covers `url(`, `@import`, `image-set(`, `-webkit-image-set(`, `src(`, `expression(`, `-moz-binding`, and a `behavior` token that is not part of a longer name such as `scroll-behavior`. A declaration that contains `\` is dropped too. The backslash is not decoded, so an escape that spells `url(` stays dropped.

- A style string drops each declaration that contains a loader or `\`. Other declarations in that string stay.
- A style object removes a property whose value contains a loader or `\`.
- `trustedStyle(css)` as the whole `style` prop assigns that CSS, including loaders and backslashes. Its return type is an `IgniteJsxChild`, so it is a legal style child. The type also carries an optional `type` that is absent at runtime. That name overlaps a hosted view, so an element whose children include this token still assigns to the host view.
- `trustedStyle(css)` as one style-object value is kept, including loaders and backslashes. The brand is `Symbol.for("ignite-element.trustedStyle")`. Any code in the same realm can forge that symbol. JSON cannot.

Declarations split on `;` and `}` outside quotes and comments. A backslash inside a quote skips the next character so `\;` does not end the string. That skip is not CSS-escape decoding. A dropped span does not leave its separator behind. A kept `{` whose `}` was in a dropped span is closed. A sibling rule stays. A sheet that is one span containing a loader becomes empty.

In a style sheet, `url(#fragment)` is `url(` and is dropped. On the SVG paint attributes in XSS-URL, `url(#fragment)` stays. `expression(` is this rule, as are `behavior` and `-moz-binding`.

### XSS-STYLE-ELEMENT

Decision: a `style` element is created, including for ordinary component CSS such as `.count { color: rebeccapurple; }`. The spike's proposal to omit the element would delete those stylesheets. The tag match uses the local name after the last `:`, then ASCII case, so `style` and `x:style` are the same rule.

Children are `createTextNode` values. They are not parsed as HTML, so `</style><img>` stays text and creates no `img`. The CSS parser concatenates those text nodes, and a comment between them does not break the join. The loader filter runs on that joined string, same match as a style attribute, including `\`, `expression(`, `behavior`, `-moz-binding`, and a comment before `url(`. The `;` and `}` split ignores those characters inside quotes and comments. A semicolon is inserted between kept declarations and is not inserted after `}`. A declaration that contains a loader or `\` is kept only when every character of that declaration is `trustedStyle` text. A loader split across children (`url` in one, `(https://…)` in the next) shares one declaration and is dropped. A declaration that is only a loader becomes empty text. The element stays. One text node holds the filtered sheet.

### XSS-SAFE-URL

`safeUrl` is an allowlist. It returns the original string when, after the same ASCII strip as XSS-URL, the value has no scheme, or the scheme is `http`, `https`, `mailto`, or `tel`. Otherwise it returns `null`. An empty string after the strip is `null`.

No scheme includes a path, a query, and a hash. A stripped value that starts with `//`, `\\`, `/\`, or `\/` returns `null`. Jose approved that refusal on PR #180.

XSS-URL calls `safeUrl` for every guarded string. `blob:` and `data:` do not render when passed to `jsx`, except a raster `data:image` on `img` or `source` `src` and `srcset`.

### XSS-ORDER

1. XSS-PROTO keys are skipped before a URL check reads `localName` and before any `Reflect.set`.
2. XSS-URL runs before the attribute or property is written.
3. XSS-SCRIPT and XSS-STYLE-ELEMENT run while normalizing, before `createElement`.
4. `trustedStyle` is recognized before the loader filter.
5. `safeSpread` runs in application code before `jsx`. The renderer rules still run.

### XSS-SUPER

- XSS-URL always runs on the guarded keys, whether or not the caller used `safeUrl`.
- `safeUrl` does not weaken XSS-URL.
- `trustedStyle` supersedes XSS-STYLE-URL for that one value.
- `options.handlers` supersedes the function ban in XSS-SPREAD for those exact keys only.
- A direct function handler is outside XSS-SPREAD.

### XSS-NO-HTML

There is no HTML writer. Nothing in this API assigns `innerHTML`, `outerHTML`, `srcdoc`, or parses a string as HTML. `dangerouslySetInnerHTML` is on that same ban: it is not written and its `__html` is not parsed. The existing content-prop bans stay.

### XSS-LOG

Development warnings for a blocked URL, an omitted `script`, or a dropped style loader name the key or the tag. They do not include the rejected value. The style-element warning still says `url()` for every dropped loader. Style elements are not omitted.

## Decided on PR #180

Jose approved these. The rules above are the code.

1. `THREAT-MODEL.md` is approved.
2. `safeUrl` refuses protocol-relative `//host`, `\\host`, `/\host`, and `\/host`.
3. Guarded URL attributes use the `safeUrl` allowlist.
4. Untrusted style drops `expression(`, a `behavior` token, `-moz-binding`, and `url(` with a comment before the paren. A declaration that contains `\` is dropped without decoding the escape.
5. A `script` with `src`, and a `link` whose `rel` or `relList` contains `stylesheet`, `preload`, `modulepreload`, or `import`, are omitted.
6. The bundle budgets are 7,100 B gzip (no-host JSX, level 6) and 8,300 B gzip (consumer, level 9). Jose raised them from 6,500 B and 7,800 B, and before that from 4,810 B and 6,280 B.

## Scope

In: the JSX renderer in `packages/ignite-renderer`, and the public helpers on the JSX entries.

Out: CSP, Trusted Types policy text, `igniteApproval`, projection-document URI keys (`isUriBearingKey` stays the old list), host `mount` that assigns `innerHTML`, and DOM mutations after commit.
