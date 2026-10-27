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

On 2026-10-27, after the reproduced declaration-separator finding on `1734f5fb2a670d9aa153c063cc4ff90a83e109bc` (discussion 4385015115), the Operator instructed: "Resolve all open threads fix the new bug". This approves the reviewed rule: always preserve required declaration separators after brace-valued custom properties; never invent separators at rule boundaries or weaken the existing loader/scriptable-CSS filtering. The portable invariant-mining fallback is this explicit rule and its existing threat-model constraints. Scope is the JSX CSS guard, focused regression/property/browser tests, focused Stryker configuration, the existing changeset, threat model and validation/approval receipts. Continue the existing isolated `codex/pr180-review-fixes` branch; frozen installation, temporary builds/packed consumers, focused red/green, applicable candidate checks, normal follow-up commits/push to `fix/ignite-jsx-xss`, evidence replies/resolution of verified threads and Codex review last are authorized. No branch switch, history rewrite, merge, release, package publication or acceptance. Preserve the 7,525 B / 8,800 B ceilings, stop on identity/custody/contract conflicts or unresolved correction failure, and remove task-generated output before final custody.

On 2026-10-26, after explanation of the prop-spread ordering rule and discussion 4384579052 on `ee28f9448d5b007a3de8334ca46b4b09ec002c48`, the Operator authorized the correction with "Let’s address this now". The reviewed rule permits preceding spreads when validated static CSS remains the final write to children; later spreads or properties capable of replacing that child remain rejected. Scope is compiler-output adoption in `packages/jsx-plugin/`, regression/property tests, focused Stryker profiles, and associated styling, changeset, approval and fail-first receipts. Frozen installation, temporary builds/packed consumers, focused red/green and applicable candidate validation, a normal follow-up commit/push on the existing isolated branch, evidence reply/resolution of the verified thread and Codex review last are authorized. Stop on identity/custody mismatch, contract conflict or unresolved correction failure. Generated task output is removed before final custody. Existing no-merge/release/package-publication/history-rewrite/acceptance and bundle-cap boundaries remain in force.

On 2026-10-26, after the two compiler-compatibility findings on `d6ccfe91dff2f8068c27ffe796e1a9adba891a62`, the Operator continued the correction with "Ensure to use fast-check and Stryker" and "Use TDD" after review of these rules: validated same-file static const CSS survives compiler downleveling without trusting application let/var or dynamic CSS; plain and prefixed style tags retain consistent author-CSS behavior through compilation and adoption without admitting non-style tags. This round covers `packages/jsx-plugin/`, focused Stryker configuration, and the associated styling, changeset, approval, and fail-first receipts. It continues the existing isolated branch, frozen installation, temporary builds/packed consumers, focused red/green and applicable candidate validation, a normal follow-up commit/push, evidence replies and resolution of verified threads, and Codex review last. Existing stop conditions and the no-merge/release/publication/history-rewrite/acceptance boundary remain in force. Task-generated output is removed before final custody.

On 2026-10-26, after review of `1b4dbce81659d10c656126afe6f7744c8898a287`, Jose authorized the two follow-up findings with "Let’s do it": propagate runtime selection through the compiler entries (discussion 4383496148) and adopt valid application `dist/` output (discussion 4383496158). This continues the isolated `codex/pr180-review-fixes` branch and authorizes the focused plugin corrections and tests, `stryker.compiler-entrypoints.config.json`, associated styling/changeset/receipt updates, frozen installation and applicable validation, a normal follow-up commit pushed to PR #180, evidence replies and resolution of the verified threads, and another Codex review request. Stop on a candidate mismatch, unexpected custody changes, architecture/public-contract conflicts, or unresolved correction failures. Generated validation output is removed before final custody. No merge, release, package publication, history rewrite, or acceptance is authorized.

On 2026-10-26, Jose authorized this correction in chat:

> let's fix all three issues on PR #180, add regression tests, and push the fixes. Don't merge it.

This authorizes the corrections to the five-package packed-consumer validation, mixed-runtime style marking, and adoption of Babel/TypeScript output. The correction uses an isolated `codex/pr180-review-fixes` worktree branch from `d738098106d8ebe58645d8e0968672ff511ce8a9`, with a normal follow-up commit pushed to `fix/ignite-jsx-xss`.

The affected paths are `packages/jsx-plugin/`, `scripts/verify-packed-consumers.mjs`, `scripts/__tests__/packed-consumer-manifest.test.mjs`, `pnpm-lock.yaml`, `docs/styling/README.md`, this manifest, and the existing unconsumed `.changeset/jsx-xss-guards.md`. Tests, builds, dependency installation for the bounded manifest/lockfile additions, temporary packed consumers, and the applicable mutation checks are authorized. Task-generated dependencies, bundles, caches, reports, and tarballs are removed from final worktree custody. Validation proceeds through focused red, focused green, and the applicable candidate checks. Report the final commit/tree, validation, custody, and remaining limitations. No merge, release, package publication, or acceptance is authorized.

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
