# Approval manifest — JSX XSS slice

Repository: `0xjcf/ignite-element`. Candidate branch: `fix/ignite-jsx-xss`. Base: `beta`. Pull request: #180. This file records the authorization for the slice. It is not a merge, a release, or a lifecycle change.

Jose approved the following on PR #180:

- Raise the no-host JSX gzip cap from 4,810 B to 6,500 B (level 6).
- Raise the consumer JSX gzip cap from 6,280 B to 7,800 B (level 9).
- Raise those caps again, to 7,100 B (no-host, level 6) and 8,300 B (consumer, level 9), and push the security re-review fixes. Jose approved that raise in his own words in chat: "Raise them to 7,100 / 8,300 and push all fixes".
- Approve `THREAT-MODEL.md`.
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
- The cap raises listed above. No further raise past 7,100 B and 8,300 B.

## Not authorized

- Merging the pull request.
- Tags, releases, or package publication.

## Stop

Stop if the measured gzip exceeds 7,100 B (no-host, level 6) or 8,300 B (consumer, level 9). Shrink the same change. Do not bump the caps again.
