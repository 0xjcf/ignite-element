# Approval manifest — JSX XSS slice

Repository: `0xjcf/ignite-element`. Candidate branch: `fix/ignite-jsx-xss`. Base: `beta`. Pull request: #180. This file records the authorization for the slice. It is not a merge, a release, or a lifecycle change.

## Authorized paths

- `packages/ignite-renderer/src/renderers/jsx/`
- `packages/ignite-renderer/src/jsx/index.ts`
- `packages/ignite-element/src/tests/renderers/jsxXss.test.ts`
- `packages/ignite-element/src/tests/renderers/browser-properties/harness.ts`
- `packages/ignite-element/vitest.stryker.xss.config.ts`
- `docs/site/src/content/docs/handbook/views.mdx`
- `.changeset/jsx-xss-guards.md`

## Authorized actions

- Commits on `fix/ignite-jsx-xss`. No amend, rebase, or merge.
- Tests, typecheck, lint, the JSX Stryker run, and production bundle measurement.
- Push to `fix/ignite-jsx-xss` and update PR #180, kept ready for review.

## Not authorized

- Merging the pull request.
- Raising the 4,810 B or 6,280 B gzip ceilings.
- Changing `safeUrl` behavior for `//host`, `\\host`, or `/\host`.
- Omitting a src-only `script` or a stylesheet `link`.
- Tags, releases, or package publication.

## Stop

Stop if the security fixes cannot be expressed without raising a bundle ceiling. Report the measured sizes and the smallest design. Do not bump the caps.
