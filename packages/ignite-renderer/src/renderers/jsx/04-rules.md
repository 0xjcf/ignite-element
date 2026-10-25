# JSX XSS rules

Slice: close the XSS gaps from `spike/ignite-jsx-xss` (`2bc840b`) in the real JSX renderer.

Jose accepted that gap list as the scope. A rule that maps directly to it is accepted. Anything marked **NEEDS JOSE** is an extra rule or an open choice. It is not implemented unless the rule text says the code does it.

The threat model is `THREAT-MODEL.md` in this directory. Jose approved it on 2026-10-22. The recorded words are in `APPROVAL.md`.

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

A `script` with an own `src`, `href`, or `xlink:href` key is omitted, whatever the value. `false`, `null`, `undefined`, `""`, and `0` count, and so does a namespaced key such as `svg:src` or `foo:xlink:href`. Every spelling counts, so `src: false` does not hide `SRC`, and `src: false` alone omits the element. That includes a prefixed tag such as `x:script` and an SVG `script`. Comment children (`null`, `true`, `false`) do not keep it. There is no trusted-script value. A `script` with none of those props and neither text nor element children is still created. A `text` prop is a source-bearing prop and is not applied on any element, on mount or on update. The same skip covers `textContent`, `innerText`, `outerText`, `innerHTML`, `outerHTML`, `srcdoc`, and `dangerouslySetInnerHTML`.

A `link` whose local name is `link` (any ASCII case, with or without a prefix) is omitted when any `rel` or `relList` spelling contains a `stylesheet`, `preload`, `modulepreload`, or `import` token. An array and a `toString` value count. Each of those values is read once, and the renderer writes that checked string. A blocked checked value does not write `href`. `preload` is omitted for every `as` value. `rel: "icon"` does not hide `REL: "stylesheet"`. `prefetch`, `dns-prefetch`, `preconnect`, `prerender`, and `icon` stay, and their `href` uses XSS-URL. After props are applied, a reflected `rel` that contains any blocked token loses `rel` and `href`.

### XSS-PROTO

These keys are never written, on a spread or on a direct prop, because the renderer cannot tell those apart:

- `__proto__`
- `constructor`
- `prototype`

The match is the exact key, not a case fold. `__PROTO__` is not the special setter and is not this rule.

`setContained` returns before `Reflect.set` for these keys. Both prop loops skip them before `in`, before a URL check reads `localName`, and before `setAttribute`.

### XSS-URL

The shared projection denylist is unchanged. The JSX renderer does not use that denylist for attributes. A guarded string is written only when the internal allowlist allows it: after the same ASCII strip, the value is `http`, `https`, `mailto`, `tel`, or has no scheme and is not protocol-relative (`//`, `\\`, `/\`, `\/`). `javascript:`, `vbscript:`, `data:`, `blob:`, and `ftp:` are not written. `data:` stays refused, including `data:image/svg+xml` and `data:image/png` on anchors and other tags. The exception is a raster `data:image/png`, `jpeg`, `jpg`, `gif`, `webp`, or `avif` on `img` or `source` `src`, `srcset`, or `imagesrcset`. The allowlist itself still returns `null` for every `data:` string. An `iframe`, `frame`, or `embed` `src`, and an `object` `data`, of `http:` or `https:` is not written. A path such as `/safe.txt` stays. The keys `host`, `hostname`, `protocol`, `port`, `pathname`, `origin`, `username`, `password`, `search`, and `hash` are never assigned.

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

`srcset` and `imagesrcset` use the HTML candidate parser. The URL is a run of non-whitespace. A comma inside that run stays in the URL, so `data:image/png;base64,…` is one candidate. A comma after the URL, including a URL that ends with a comma, separates candidates. Descriptors stay with their candidate. Each full candidate must pass the internal allowlist, so a scheme split by whitespace is still blocked and a descriptor such as `1x` stays glued on. If any candidate is blocked, the whole attribute is dropped. It is not rewritten into a shorter list. On `img` and `source`, a raster `data:image` candidate is kept. On every other element it is dropped. A candidate with no space, such as `https://cdn.example/a.png,javascript:alert(1)`, is one URL token whose scheme is `https`, and it is kept.

`ping` is blocked when the stripped whole value is dangerous, or when any token split on HTML whitespace (tab, line feed, form feed, carriage return, space) is dangerous. The whole-value check catches a scheme that hides a whitespace character. The token check catches a safe URL beside a dangerous one, which the strip would otherwise glue together. If either check fails, the whole attribute is dropped. A NUL inside one token is not a separator, so `java\u0000script:` is still one token and is blocked.

Non-string values on a guarded key are not applied. SMIL `from`, `to`, `by`, and `values` are still blocked when `attributeName` targets `href`. Paint and SMIL values run the untrusted-CSS loader check, so a backslash, `image-set(`, `src(`, or `@import` is dropped. The only value that skips that check is a whole value of `url(#id)`, `url("#id")`, or `url('#id')`, with an id that has no whitespace, quote, or parenthesis. That covers `fill`, `stroke`, `filter`, `mask`, `clip-path`, `marker`, `marker-start`, `marker-mid`, `marker-end`, and `cursor`. Meta refresh stays blocked. `object` `archive` and `classid`, `embed` `code` and `pluginspage`, and `param` `value` are not guarded keys: an `https:` URL is written, and Chrome does not load it.

### XSS-SPREAD

The renderer skips `text`, `textContent`, `innerText`, `outerText`, `innerHTML`, `outerHTML`, `srcdoc`, and `dangerouslySetInnerHTML` on every element. The match is ASCII case-insensitive. It also skips `relList` on every element. A `link` whose `rel` is a stylesheet, `preload`, `modulepreload`, or `import` is still omitted.

A key is a handler key when it matches `/^on[A-Z]/`, or when its lowercase form is `on` plus a real event name. The name is real when it is in the guard's fixed list, or when `on` plus that name is on `HTMLElement`, `Window`, `Document`, `SVGElement`, `window`, or `document`. The fixed list is the WHATWG `GlobalEventHandlers` names plus `animationend`, `transitionend`, `selectstart`, `command`, and `pagereveal`, and the names those objects do not expose, such as `begin`, `repeat`, and `search`. `search` is the Chromium `onsearch` handler, which is not on `HTMLElement`. The prototype check is the fallback for a name the list does not have. `onClick`, `onclick`, `ONERROR`, and `ononline` are handler keys. `one`, `online`, and `onlyIcon` are not. `xlink:onclick` is dropped as a string attribute.

A string handler is not an attribute. A function handler registers with `addEventListener`. A function that arrived inside a spread object is the same shape once it reaches `jsx()`, so it runs too. The URL property setters (`host`, `hostname`, `protocol`, `port`, `pathname`, `origin`, `username`, `password`, `search`, `hash`) are not assigned.

### XSS-STYLE-URL

Untrusted style loads no URL and runs no legacy scriptable property. The prop key match is ASCII case-insensitive, so `style`, `Style`, and `STYLE` are the same sink. The raw declaration is checked, and so is the declaration with comments removed, so `url/**/(` and `url /*c*/ (` are `url(`. A `/*` inside a string cannot hide a later `url(` or `expression(`, because the raw text still contains that token. The loader match is case-insensitive and allows whitespace before `(`. It covers `url(`, `@import`, `image-set(`, `-webkit-image-set(`, `src(`, `expression(`, `-moz-binding`, and a `behavior` token that is not part of a longer name such as `scroll-behavior`. A declaration that contains `\` is dropped too. The backslash is not decoded, so an escape that spells `url(` stays dropped.

- A style string drops each declaration that contains a loader or `\`. Other declarations in that string stay.
- A style object removes a property whose value contains a loader or `\`, and a property whose name and checked value join into a loader once comments are removed. A custom element's own `style` setter receives a new plain object. Each own value is read once. `null` as the whole `style` value is passed through to that setter. A string entry is that checked string. A number arrives as a string, so `{ opacity: 0 }` is `"0"`. A `null` entry stays `null`. An `undefined` entry is omitted. An inherited property and a live `toString` are not passed through.
- A style attribute or style object never keeps `url()`, `@import`, or a scriptable token. Prop data goes through a CSS custom property. `url()` inside a custom-property value is data and is dropped.
- Author CSS is a static `<style>` string, a same-file const, or a `*.css?raw` default import, marked by the build. The mark is a module-local symbol, not `Symbol.for`. A forged symbol, a second installed copy, and a proxy that is not the recorded object contribute no CSS. A custom element's `style` setter must write each entry as a `key:value` declaration. Joining the values alone can rebuild a loader from neighbouring fragments.

Declarations split on `{`, `;`, and `}` outside quotes and comments. A backslash inside a quote skips the next character so `\;` does not end the string. That skip is not CSS-escape decoding. A dropped span does not leave its separator behind. A dropped declaration closes the blocks it owed before the next kept rule, so the next rule is not nested inside the dropped block. A selector whose declarations were all dropped stays as an empty rule. A semicolon is not inserted after `{` or `}`.

In a style sheet, `url(#fragment)` is `url(` and is dropped. On the SVG paint attributes in XSS-URL, `url(#fragment)` stays. `expression(` is this rule, as are `behavior` and `-moz-binding`.

### XSS-STYLE-ELEMENT

Decision: a `style` element is created, including for ordinary component CSS such as `.count { color: rebeccapurple; }`. The spike's proposal to omit the element would delete those stylesheets. The tag match uses the local name after the last `:`, then ASCII case, so `style` and `x:style` are the same rule.

Children are `createTextNode` values. They are not parsed as HTML, so `</style><img>` stays text and creates no `img`. The CSS parser concatenates those text nodes, and a comment between them does not break the join. The loader filter runs on that joined string. On an unmarked sheet the match is the same as a style attribute, including `\`, `expression(`, `behavior`, `-moz-binding`, and a comment before `url(`. A sheet is marked only when every text child was marked by the build. A marked sheet keeps `url()`, `@import`, `image-set(`, `-webkit-image-set(`, `src(`, and `\`. It still drops `expression(`, a `behavior` token, and `-moz-binding`. `</` or `<!` drops the whole sheet. The `;` and `}` split ignores those characters inside quotes and comments. A semicolon is inserted between kept declarations and is not inserted after `}`. A loader split across children (`url` in one, `(https://…)` in the next) shares one declaration and is dropped, and any unmarked sibling leaves the whole sheet unmarked. A declaration that is only a loader becomes empty text. The element stays. One text node holds the filtered sheet. If the plugin is missing, a dropped `url()` or `@import` warns in development and is silent in production.

### XSS-SAFE-URL

The URL allowlist stays inside the renderer. It returns the original string when, after the same ASCII strip as XSS-URL, the value has no scheme, or the scheme is `http`, `https`, `mailto`, or `tel`. Otherwise it returns `null`. An empty string after the strip is `null`. It is not a public export.

No scheme includes a path, a query, and a hash. A stripped value that starts with `//`, `\\`, `/\`, or `\/` returns `null`. Jose approved that refusal on PR #180.

XSS-URL uses that allowlist for every guarded string. `blob:` and `data:` do not render when passed to `jsx`, except a raster `data:image` on `img` or `source` `src` and `srcset`.

### XSS-ORDER

1. XSS-PROTO keys are skipped before a URL check reads `localName` and before any `Reflect.set`.
2. XSS-URL runs before the attribute or property is written.
3. XSS-SCRIPT and XSS-STYLE-ELEMENT run while normalizing, before `createElement`.
4. An author mark is recognized before the loader filter. An unmarked sheet drops `url()` and `@import`.
5. String handlers, `text`, and `relList` are dropped while props are applied. A function handler still runs.

### XSS-SUPER

- XSS-URL always runs on the guarded keys.
- The internal allowlist does not weaken XSS-URL.
- A build mark keeps author loads in a `<style>` element. It does not keep a loader in `style={}`.
- A function handler still runs, including one that arrived by spread.
- String handlers do not.

### XSS-NO-HTML

There is no HTML writer. Nothing in this API assigns `innerHTML`, `outerHTML`, `srcdoc`, or parses a string as HTML. `dangerouslySetInnerHTML` is on that same ban: it is not written and its `__html` is not parsed. The existing content-prop bans stay.

### XSS-LOG

Development warnings for a blocked URL, an omitted `script`, or a dropped style loader name the key or the tag. They do not include the rejected value. The style-element warning still says `url()` for every dropped loader. Style elements are not omitted.

## Decided on PR #180

Jose approved these. The rules above are the code.

1. `THREAT-MODEL.md` is approved.
2. The internal allowlist refuses protocol-relative `//host`, `\\host`, `/\host`, and `\/host`.
3. Guarded URL attributes use that allowlist.
4. Untrusted style drops `expression(`, a `behavior` token, `-moz-binding`, and `url(` with a comment before the paren. A declaration that contains `\` is dropped without decoding the escape.
5. A `script` with `src`, and a `link` whose `rel` or `relList` contains `stylesheet`, `preload`, `modulepreload`, or `import`, are omitted. `prefetch`, `dns-prefetch`, `preconnect`, `prerender`, and `icon` keep an `https` href.
6. The bundle budgets are 7,525 B gzip (no-host JSX, level 6) and 8,800 B gzip (consumer, level 9). Jose set those ceilings on Oct 24 2026. The ceilings cannot be raised without Jose's own word. The previous ceilings were 7,500 B and 8,750 B, from "Yes to the replies, raise the caps and ship N11" on 2026-10-23. Earlier that day he approved the four Security P3s and a raise only as far as those fixes need; Node 22 then measured 7,544 B and 8,790 B, and those caps were 7,564 B and 8,810 B. On 2026-10-22 his words were "settle the object-style gap first and increase the budget", which raised them to 7,200 B and 8,400 B. He had raised them to 7,100 B and 8,300 B, before that from 6,500 B and 7,800 B, and before that from 4,810 B and 6,280 B.

## Scope

In: the JSX renderer in `packages/ignite-renderer`, and the build mark from `@ignite-element/jsx-plugin`.

Out: CSP, Trusted Types policy text, `igniteApproval`, projection-document URI keys (`isUriBearingKey` stays the old list), host `mount` that assigns `innerHTML`, and DOM mutations after commit.
