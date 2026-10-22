# Approval manifest — JSX XSS slice

Repository: `0xjcf/ignite-element`. Candidate branch: `fix/ignite-jsx-xss`. Base: `beta`. Pull request: #180. This file records the authorization for the slice. It is not a merge, a release, or a lifecycle change.

Jose approved the following on PR #180:

- Raise the no-host JSX gzip cap from 4,810 B to 6,500 B (level 6).
- Raise the consumer JSX gzip cap from 6,280 B to 7,800 B (level 9).
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

## Authorized actions

- Commits on `fix/ignite-jsx-xss`. No amend, rebase, or merge.
- Tests, typecheck, lint, the JSX Stryker run, and production bundle measurement.
- Push to `fix/ignite-jsx-xss` and update PR #180, kept ready for review.
- The cap raises listed above. No further raise.

## Not authorized

- Merging the pull request.
- Tags, releases, or package publication.

## Stop

Stop if the measured gzip exceeds 6,500 B (no-host, level 6) or 7,800 B (consumer, level 9). Shrink the same change. Do not bump the caps again.
