# Approval manifest — JSX XSS slice

Repository: `0xjcf/ignite-element`. Candidate branch: `fix/ignite-jsx-xss`. Base: `beta`. Pull request: #180. This file records the authorization for the slice. It is not a merge, a release, or a lifecycle change.

Jose approved the following on PR #180. The quotes below are his words as recorded in chat on 2026-10-22, not a paraphrase added later.

On 2026-10-22, applied in `23aead7c` (11:15Z), the chat recorded his decisions as:

> Jose approved these decisions himself on PR #180.
>
> 1. Size caps: raise no-host JSX gzip cap 4,810 -> 6,500 B and consumer JSX cap 6,280 -> 7,800 B. Note Jose's approval in the PR body and in APPROVAL.md.
> 2. Approve THREAT-MODEL.md: drop its NEEDS JOSE marker and update it for the changes below.

On 2026-10-22, applied in `74fba5ef` (12:49Z), his own words on the second cap raise were:

> Raise them to 7,100 / 8,300 and push all fixes

On 2026-10-22, his own words on the object-style gap and the third cap raise were:

> settle the object-style gap first and increase the budget

On 2026-10-23, his own words on the handler list and the fourth cap raise were:

> Yes to the replies, raise the caps and ship N11

Those decisions are:

- Raise the no-host JSX gzip cap from 4,810 B to 6,500 B (level 6).
- Raise the consumer JSX gzip cap from 6,280 B to 7,800 B (level 9).
- Raise those caps again, to 7,100 B (no-host, level 6) and 8,300 B (consumer, level 9), and push the security re-review fixes.
- Raise those caps again, to 7,200 B (no-host, level 6) and 8,400 B (consumer, level 9), and filter each value of a style object before a custom element's own `style` setter sees it.
- Raise those caps again, to 7,500 B (no-host, level 6) and 8,750 B (consumer, level 9), and ship the fixed handler-name list.
- On 2026-10-23, Jose approved the four Security P3s at `18ce1a49` and raising each cap only as far as those fixes need. Node 22 measures 7,544 B and 8,790 B. Those caps were 7,564 B and 8,810 B.
- On Oct 24 2026, Jose set the ceilings to 7,525 B (no-host, gzip level 6) and 8,800 B (consumer, gzip level 9). The ceilings cannot be raised without Jose's own word.
- `THREAT-MODEL.md` is approved.
- `safeUrl` refuses `//host`, `\\host`, `/\host`, and `\/host`.
- Guarded URL attributes use the `safeUrl` allowlist.
- Untrusted style drops `expression(`, a `behavior` token, `-moz-binding`, and `url(` with a comment before the paren. A backslash still drops the declaration and is not decoded.
- Omit a `script` with `src`, and a `link` whose `rel` contains `stylesheet`, in any ASCII case or prefix.

## Authorized paths

- `packages/ignite-renderer/src/renderers/jsx/`
- `packages/ignite-renderer/src/jsx/index.ts`
- `packages/ignite-element/src/tests/renderers/jsxXss.test.ts`
- `packages/ignite-element/src/tests/renderers/dangerous-sinks.test.ts`
- `packages/ignite-element/src/tests/renderers/browser-properties/harness.ts`
- `packages/ignite-element/vitest.stryker.xss.config.ts`
- `docs/site/src/content/docs/handbook/views.mdx`
- `.changeset/jsx-xss-guards.md`
- `scripts/__tests__/host-jsx-size.test.mjs`
- `scripts/__tests__/renderer-jsx-bundle.test.mjs`
- `AGENTS.md`
- `README.md`
- `packages/ignite-element/README.md`
- `packages/ignite-element/scripts/verify-exports.mjs`
- `packages/ignite-renderer/src/renderers/ignite-jsx.ts`
- `packages/ignite-renderer/src/renderers/jsx/jsx-runtime.ts`
- `docs/site/scripts/check-handbook.mjs`
- `docs/site/src/content/docs/index.mdx`
- `docs/site/src/examples/light-switch/`
- `docs/site/src/examples/smart-home-explainer/src/`
- `docs/site/src/pages/examples/light-switch.zip.ts`
- `examples/frameworks/react/src/counter.ignite.tsx`
- `experimental/ignite-jsx-xss/`
- `stryker.config.json`
- `stryker.renderer.config.json`
- `stryker.xss.config.json`

## Authorized actions

- Commits on `fix/ignite-jsx-xss`. No amend, rebase, or merge.
- Tests, typecheck, lint, the JSX Stryker run, and production bundle measurement.
- Push to `fix/ignite-jsx-xss` and update PR #180, kept ready for review.
- The cap raises listed above. No further raise past 7,525 B and 8,800 B.

## Not authorized

- Merging the pull request.
- Tags, releases, or package publication.

## Stop

Stop if the measured gzip exceeds 7,525 B (no-host, level 6) or 8,800 B (consumer, level 9). Shrink the same change. Do not bump the caps again.
