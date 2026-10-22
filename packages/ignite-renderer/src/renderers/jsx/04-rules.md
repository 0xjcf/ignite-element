# JSX XSS rules

Slice: close the XSS gaps from `spike/ignite-jsx-xss` (`2bc840b`) in the real JSX renderer.

Jose accepted that gap list as the scope. A rule that maps directly to it is accepted. Anything marked **NEEDS JOSE** is an extra rule or an open choice. It is not implemented unless the rule text says the code does it.

The threat model is `THREAT-MODEL.md` in this directory. **NEEDS JOSE approval.**

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

A `script` with neither text nor element children is still created. That includes no children, comment children (`null`, `true`, `false`), and a `src` URL with only those. `src` stays under XSS-URL. There is no trusted-script value. A `text` prop on a `script` element is a source-bearing prop and is not applied, on mount or on update. `safeSpread` drops `text`, `textContent`, `innerText`, `outerText`, `innerHTML`, `outerHTML`, `srcdoc`, and `dangerouslySetInnerHTML`.

### XSS-PROTO

These keys are never written, on a spread or on a direct prop, because the renderer cannot tell those apart:

- `__proto__`
- `constructor`
- `prototype`

The match is the exact key, not a case fold. `__PROTO__` is not the special setter and is not this rule.

`setContained` returns before `Reflect.set` for these keys. Both prop loops skip them before `in`, before a URL check reads `localName`, and before `setAttribute`. `safeSpread` drops them too.

### XSS-URL

The shared projection denylist is unchanged. After ASCII space and the controls at or below U+0020, plus DEL, are stripped, a value is blocked when it is `javascript:`, `vbscript:`, `data:text/html`, `data:image/svg+xml`, or `data:application/xhtml+xml`. The JSX guard also blocks `data:text/xml`, `data:application/xml`, and any `data:` type whose subtype ends in `+xml`. `script`, `iframe`, `frame`, `object`, `embed`, and `applet` also reject every other `data:` URL.

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

`srcset` uses the HTML candidate parser. The URL is a run of non-whitespace. A comma inside that run stays in the URL, so `data:image/png;base64,…` is one candidate. A comma after the URL, including a URL that ends with a comma, separates candidates. Descriptors stay with their candidate. Each full candidate is checked with the same strip, so a scheme split by whitespace is still blocked and a descriptor such as `1x` stays glued on after the strip. If any candidate is blocked, the whole attribute is dropped. It is not rewritten into a shorter list. A `data:image/png` candidate is not on the denylist, so a PNG `srcset` still applies. A candidate with no space, such as `https://cdn.example/a.png,javascript:alert(1)`, is one URL token and is kept.

`ping` is blocked when the stripped whole value is dangerous, or when any token split on HTML whitespace (tab, line feed, form feed, carriage return, space) is dangerous. The whole-value check catches a scheme that hides a whitespace character. The token check catches a safe URL beside a dangerous one, which the strip would otherwise glue together. If either check fails, the whole attribute is dropped. A NUL inside one token is not a separator, so `java\u0000script:` is still one token and is blocked.

Non-string values on a guarded key are not applied. SMIL `from`, `to`, `by`, `values`, and meta refresh stay as they are today.

### XSS-SPREAD

`safeSpread(props, options?)` copies enumerable own string keys, except the three XSS-PROTO keys and the source-bearing keys `text`, `textContent`, `innerText`, `outerText`, `innerHTML`, `outerHTML`, `srcdoc`, and `dangerouslySetInnerHTML`. The match for those keys is ASCII case-insensitive.

A key is a handler key when it matches `/^on[A-Z]/`, or when its lowercase form is `on` plus a real event name. The name is real when `on` plus that name is on `HTMLElement`, `Window`, `Document`, or `SVGElement`, or when it is in the guard's list of names those prototypes sometimes lack, such as `animationend` and `begin`. `onClick`, `onclick`, `ONERROR`, and `ononline` are handler keys. `one`, `online`, and `onlyIcon` are not. `xlink:onclick` is not a handler key here; the renderer already drops that string attribute.

A handler key is copied only when the value is a function and `options.handlers` lists that exact key. `onClick` does not allow `onclick`. A string handler is never copied, even if the key is listed.

A direct JSX `onClick={fn}` does not go through `safeSpread` and still registers with `addEventListener`. The spike's `it.fails` passed `onClick` straight to `jsx` and expected silence. This rule follows the accepted API instead of removing direct handlers.

Other keys are copied as they are. The renderer still applies XSS-URL and the string-handler drop after `safeSpread`.

### XSS-STYLE-URL

Untrusted style loads no URL. The prop key match is ASCII case-insensitive, so `style`, `Style`, and `STYLE` are the same sink. The loader match is case-insensitive and allows whitespace before `(`. It covers `url(`, `@import`, `image-set(`, `-webkit-image-set(`, and `src(`. A declaration that contains `\` is dropped too. The backslash is not decoded.

- A style string drops each declaration that contains a loader or `\`. Other declarations in that string stay.
- A style object removes a property whose value contains a loader or `\`.
- `trustedStyle(css)` as the whole `style` prop assigns that CSS, including loaders and backslashes. Its return type is an `IgniteJsxChild`, so it is a legal style child. The type also carries an optional `type` that is absent at runtime. That name overlaps a hosted view, so an element whose children include this token still assigns to the host view.
- `trustedStyle(css)` as one style-object value is kept, including loaders and backslashes. The brand is `Symbol.for("ignite-element.trustedStyle")`. Any code in the same realm can forge that symbol. JSON cannot.

Declarations split on `;` only outside quotes and comments. A backslash inside a quote skips the next character so `\;` does not end the string. That skip is not CSS-escape decoding.

`url(#fragment)` is `url(` and is included. `expression(` is not this rule. The CSS parser already drops it in the engines the existing sink tests use.

### XSS-STYLE-ELEMENT

Decision: a `style` element is created, including for ordinary component CSS such as `.count { color: rebeccapurple; }`. The spike's proposal to omit the element would delete those stylesheets. The tag match uses the local name after the last `:`, then ASCII case, so `style` and `x:style` are the same rule.

Children are `createTextNode` values. They are not parsed as HTML, so `</style><img>` stays text and creates no `img`. The CSS parser concatenates those text nodes, and a comment between them does not break the join. The loader filter runs on that joined string, same match as a style attribute, including `\`. The `;` split ignores semicolons inside quotes and comments. A declaration that contains a loader or `\` is kept only when every character of that declaration is `trustedStyle` text. A loader split across children (`url` in one, `(https://…)` in the next) shares one declaration and is dropped. A declaration that is only a loader becomes empty text. The element stays. One text node holds the filtered sheet.

### XSS-SAFE-URL

`safeUrl` is an allowlist. It returns the original string when, after the same ASCII strip as XSS-URL, the value has no scheme, or the scheme is `http`, `https`, `mailto`, or `tel`. Otherwise it returns `null`. An empty string after the strip is `null`.

No scheme includes a path, a query, a hash, and, today, a protocol-relative `//host`. `\\host` and `/\host` also have no scheme match, so they pass too. **NEEDS JOSE** whether those should be refused. The code allows them until Jose says otherwise.

`safeUrl` is stricter than XSS-URL. It is not applied automatically to attributes. `blob:` and `data:image/png` still render when passed to `jsx`. **NEEDS JOSE** whether the renderer denylist should become this allowlist. The code does not do that.

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

## NEEDS JOSE

These are not implemented. They are listed so they are not silent.

1. Approve `THREAT-MODEL.md`.
2. Should `safeUrl` refuse protocol-relative `//host`, and the same open redirect spelled `\\host` or `/\host`? Security's recommendation, not implemented: before the no-scheme return, reject a stripped value matching `/^[\\/]{2}|^\/\\|^\\//`. Optionally add `safeUrl(value, { allowHosts })`. Verifier reproduced `//evil.com` unchanged and treats it as an open P2. The code still returns those strings until Jose decides.
3. Should the renderer switch from the denylist to the `safeUrl` allowlist for the guarded keys? Security's recommendation, not implemented: keep the renderer denylist as the always-on floor, keep `safeUrl` as the documented path for untrusted input, and consider a later allowlist for `script src`, `iframe src`, `object data`, `embed src`, and `form action`.
4. Should untrusted style also drop `expression(`, `behavior`, and `-moz-binding`, instead of relying on the CSS parser for `expression(`? A CSS comment inside a loader token (`url/*x*/(`) is the same class of gap: the filter is a string search, not a tokenizer. Element children inside `style` are not a stylesheet in Chromium (the sheet stays empty), so they are not a load.
5. Should a `script` with only `src`, or a `link rel=stylesheet`, be omitted too? XSS-SCRIPT still creates a src-only script. A `link` `href` is still written when it passes XSS-URL, so an `https` script or stylesheet from props still loads. Security's recommendation, not implemented: refuse a non-trusted `script src` and a stylesheet `link`. Verifier confirmed a stylesheet link loads.
6. The bundle budgets are 4,810 B gzip (no-host JSX, level 6) and 6,280 B gzip (consumer, level 9). This slice's production checks are measured against both. Do not raise them. A raise is Jose's. CSS escapes that spell a loader are not an open question: untrusted CSS drops any declaration that contains `\`, without decoding it.

## Scope

In: the JSX renderer in `packages/ignite-renderer`, and the public helpers on the JSX entries.

Out: CSP, Trusted Types policy text, `igniteApproval`, projection-document URI keys (`isUriBearingKey` stays the old list), host `mount` that assigns `innerHTML`, and DOM mutations after commit.
