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
| LOG-2 | applies | A warning may name the prop key. It must not include the rejected URL, CSS text, script source, or handler body. | XSS-LOG. `jsxXss.test.ts` asserts a blocked URL warning does not contain the payload. |
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

A `script` element is omitted when its normalized children include any text node. The tag match is ASCII case-insensitive, so `script` and `SCRIPT` are the same rule.

Text nodes come from string children, number children, and a component that returns either. An empty string is still a text node, so the element is omitted.

A `script` with no text node is still created. That includes no children, comment children (`null`, `true`, `false`), and a `src` URL with no text. `src` stays under XSS-URL. There is no trusted-script value.

### XSS-PROTO

These keys are never written, on a spread or on a direct prop, because the renderer cannot tell those apart:

- `__proto__`
- `constructor`
- `prototype`

The match is the exact key, not a case fold. `__PROTO__` is not the special setter and is not this rule.

`setContained` returns before `Reflect.set` for these keys. Both prop loops skip them before `in`, before a URL check reads `localName`, and before `setAttribute`. `safeSpread` drops them too.

### XSS-URL

The renderer denylist is unchanged. After ASCII space and the controls at or below U+0020, plus DEL, are stripped, a value is blocked when it is `javascript:`, `vbscript:`, `data:text/html`, `data:image/svg+xml`, or `data:application/xhtml+xml`. `script`, `iframe`, `frame`, `object`, `embed`, and `applet` also reject every other `data:` URL.

The prop key is lowercased, so `srcSet` is `srcset`. The guarded keys are:

- `href` (already guarded; `base` `href` stays unconditionally blocked)
- `src`
- `action`
- `formaction` (`formAction` is the same key)
- `xlink:href`
- `codebase`
- `data` on `object` only
- `srcset` on every element, including `img` and `source`
- `poster` on every element, including `video`
- `background` on every element, including `body`
- `cite` on every element, including `blockquote`, `q`, `del`, and `ins`
- `ping` on every element, including `a` and `area`

`srcset` is a comma-separated candidate list. Each candidate is checked with the same strip. A descriptor such as `1x` stays glued to the URL after the strip, which still leaves a leading scheme visible. If any candidate is blocked, the whole attribute is dropped. It is not rewritten into a shorter list. A `data:image/png` candidate is not on the denylist, so a PNG `srcset` still applies.

`ping` is split on HTML whitespace first (tab, line feed, form feed, carriage return, space), then each token is stripped and checked. If any token is blocked, the whole attribute is dropped. A NUL inside one token is not a separator, so `java\u0000script:` is still one token and is blocked.

Non-string values on a guarded key are not applied. SMIL `from`, `to`, `by`, `values`, and meta refresh stay as they are today.

### XSS-SPREAD

`safeSpread(props, options?)` copies enumerable own string keys, except the three XSS-PROTO keys.

A key is a handler key when its lowercase form starts with `on` and the key is longer than `on`. `onClick`, `onclick`, and `ONERROR` are handler keys. `xlink:onclick` is not a handler key here; the renderer already drops that string attribute.

A handler key is copied only when the value is a function and `options.handlers` lists that exact key. `onClick` does not allow `onclick`. A string handler is never copied, even if the key is listed.

A direct JSX `onClick={fn}` does not go through `safeSpread` and still registers with `addEventListener`. The spike's `it.fails` passed `onClick` straight to `jsx` and expected silence. This rule follows the accepted API instead of removing direct handlers.

Other keys are copied as they are. The renderer still applies XSS-URL and the string-handler drop after `safeSpread`.

### XSS-STYLE-URL

Untrusted style applies no `url(`. The match is case-insensitive and allows whitespace before `(`.

- A style string drops each `;` declaration that contains `url(`. Other declarations in that string stay.
- A style object removes a property whose value contains `url(`.
- `trustedStyle(css)` as the whole `style` prop assigns that CSS, including `url(`.
- `trustedStyle(css)` as one style-object value is kept, including `url(`.

`url(#fragment)` is `url(` and is included. `expression(` is not this rule. The CSS parser already drops it in the engines the existing sink tests use.

### XSS-STYLE-ELEMENT

Decision for `<style>` children: the element is omitted when any normalized child is an element, or a text node that did not come from `trustedStyle`. `trustedStyle` children become text nodes and the element is created. Comment children (`null`, `true`, `false`) and an empty element do not omit it. Mixed trusted and untrusted text omits the whole element.

The text is a `createTextNode` child. It is not parsed as HTML. A trusted string that contains `</style>` stays text.

### XSS-SAFE-URL

`safeUrl(value)` returns the original string when, after the same ASCII strip as XSS-URL, the value has no scheme, or the scheme is `http`, `https`, `mailto`, or `tel`. Otherwise it returns `null`. An empty string after the strip is `null`.

No scheme includes a path, a query, a hash, and a protocol-relative `//host`. **NEEDS JOSE** whether `//host` should be refused. The code allows it, as a relative URL, until Jose says otherwise.

`safeUrl` is stricter than XSS-URL. It is not applied automatically to attributes. `blob:` and `data:image/png` still render when passed to `jsx`. **NEEDS JOSE** whether the renderer denylist should become this allowlist. The code does not do that.

### XSS-ORDER

1. XSS-PROTO keys are skipped before a URL check reads `localName` and before any `Reflect.set`.
2. XSS-URL runs before the attribute or property is written.
3. XSS-SCRIPT and XSS-STYLE-ELEMENT run while normalizing, before `createElement`.
4. `trustedStyle` is recognized before the `url(` filter.
5. `safeSpread` runs in application code before `jsx`. The renderer rules still run.

### XSS-SUPER

- XSS-URL always runs on the guarded keys, whether or not the caller used `safeUrl`.
- `safeUrl` does not weaken XSS-URL.
- `trustedStyle` supersedes XSS-STYLE-URL for that one value.
- `options.handlers` supersedes the function ban in XSS-SPREAD for those exact keys only.
- A direct function handler is outside XSS-SPREAD.

### XSS-NO-HTML

There is no HTML writer. Nothing in this API assigns `innerHTML`, `outerHTML`, `srcdoc`, or parses a string as HTML. The existing content-prop bans stay.

### XSS-LOG

Development warnings for a blocked URL, an omitted `script`, or an omitted `style` name the key or the tag. They do not include the rejected value.

## NEEDS JOSE

These are not implemented. They are listed so they are not silent.

1. Approve `THREAT-MODEL.md`.
2. Should `safeUrl` refuse protocol-relative `//host`?
3. Should the renderer switch from the denylist to the `safeUrl` allowlist for the guarded keys?
4. Should untrusted style also drop `expression(`, `behavior`, and `-moz-binding`, instead of relying on the CSS parser for `expression(`?
5. Should CSS escapes that spell `url(` (`\75 rl(`) be rejected? The check is a string search, not a CSS parser.
6. Should a `script` with only `src` be omitted too? XSS-SCRIPT still creates it.
7. The bundle budgets are 4,810 B gzip (no-host JSX, level 6) and 6,280 B gzip (consumer, level 9). This slice's production checks will be measured against both. A raise is Jose's.

## Scope

In: the JSX renderer in `packages/ignite-renderer`, and the public helpers on the JSX entries.

Out: CSP, Trusted Types policy text, `igniteApproval`, projection-document URI keys (`isUriBearingKey` stays the old list), host `mount` that assigns `innerHTML`, and DOM mutations after commit.
