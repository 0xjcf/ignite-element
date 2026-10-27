# Fail-first tests

## PR #180 compiler-style correction — 2026-10-26

Baseline: `d6ccfe91dff2f8068c27ffe796e1a9adba891a62`, tree `c74518b80dfd1c2dd81f2d8e778d840cfb593972`. The Operator reviewed the two contract rules in chat, then directed: "Ensure to use fast-check and Stryker" and "Use TDD". The rules are: validated same-file const CSS survives compiler downleveling without trusting application let/var or dynamic values; plain and prefixed style tags retain the same behavior through compilation and adoption, while non-style tags remain untrusted.

**Focused red:** `pnpm --filter @ignite-element/jsx-plugin exec vitest --run src/compiler-style-properties.test.ts` failed 17 of the initial 22 cases on the unchanged baseline source. Seed 1803 immediately shrank to a literal const stylesheet and to an `x:style` stylesheet; compiler-output adoption rejected both. TypeScript preserve mode also missed a prefixed sibling. Raw-CSS aliases under shadowing exposed the related downleveling seam before the fix.

**Focused green:** the suite now passes 27 cases. Fast-check uses seed 1803 with 24 runs per compiler for const/alias/template values and mutable/dynamic rejection, 18 for tag recognition, and 12 for emitted mutable-binding rejection. Each const case checks default, ES5, ES2015, and ESNext output. Mark arguments retain the exact CSS value, adoption is idempotent, and esbuild/Vite consume the emitted output. Runtime execution checks the branded CSS value across raw-import aliases and shadowing. Side-effect/named imports and look-alike non-style tags are covered. No existing assertion, source-security guard, or mutation threshold was weakened.

**Mutation:** `pnpm exec stryker run stryker.compiler-style.config.json` scores **87.59%**: 127 killed, 15 survived, 3 without coverage, zero timeouts/errors. The threshold remains 80. The profile covers the constant-resolution helper and dispatch, lowered-tag validation, and the changed Babel/TypeScript seams. The first 83.44% run led to side-effect-import and look-alike-tag checks and removal of duplicate TypeScript tag classification. A subsequent per-test run reported an empty-helper survivor, although a direct negative-control run failed 12 regressions. The final profile uses `coverageAnalysis: "all"`, without static-mutant exclusion, and kills that control. Remaining survivors change internal ref tags/alias spellings, duplicate a safe import, remove guards already implied by prior static validation, add an irrelevant sentinel to the import-name set, or reparse an unchanged source file; uncovered paths are the validated-helper fallback and invalid cooked-template fallback. No additional current-candidate failure was found in survivor triage.

**Candidate validation:** Node 22.23.3 / pnpm 10.33.0; lockfile blob `2bc9410b3def99443ea4709d6720c81a9ebdc5af` unchanged. Package/docs build, final plugin typecheck, native Babel PluginItem strict consumer, NodeNext declarations, final strict five-package packed consumers (including optional-peer isolation), architecture checks, repo lint, and changed-file formatting pass. The full package run passed 1,557 library tests (2 existing todos) and 139 plugin tests; after the final TypeScript simplification and added side-effect case the full plugin run passed 140 tests. Script tests pass 169/169, example typechecks pass 13 roots, and runtime tests pass 10 roots. The five unchanged baseline whole-repository formatting failures described below remain `workflow_improvement`; this is not merge, staging, release, or acceptance approval. Renderer implementation and approved bundle ceilings are unchanged.

**Custody and friction:** focused red took 1.14 seconds and final focused green 1.80 seconds. Completed mutation runs took 34, 29, and 29 seconds; the extra runs improved coverage and checked the filtering discrepancy. Attempts with missing built fixtures or overlapping build cleanup stopped before mutation; builds and snapshots were then serialized. The coverage-mode switch also required removing its incompatible static-exclusion option. The first declaration check could not npm-pack through the default cache; the disposable task cache passed without source changes. Frozen installation reused cached dependencies; the native Babel probe installed nine temporary packages. Task-generated dependencies, builds, reports, caches, and probe files are removed before final custody. No history rewrite, merge, package publication, release, or acceptance is performed.

## Compiler-entrypoint follow-up — 2026-10-26

Baseline: `1b4dbce81659d10c656126afe6f7744c8898a287`, tree `78927714f60b365d66151a66942e98a736064475`. This round addresses discussions 4383496148 and 4383496158.

`pnpm --filter @ignite-element/jsx-plugin exec vitest --run src/compiler-entrypoints.test.ts` initially failed all nine cases: Babel, Babel development, TypeScript, and TypeScript development marked non-Ignite compiler output; all four failed author-mark adoption from application `dist` directories; and invalid marks bypassed validation in that directory. Property cases use seed 1802 with eight runs per compiler. The expanded suite also covers defaults, pragma precedence, preserve mode, Babel's configured cwd for in-memory source, unrelated plugin names and imports, and dependency/library filtering including Windows-shaped input IDs.

The correction passes Babel's normalized JSX-transform options or project selection, and TypeScript's compiler selection, into marking. Application `dist` files reach the existing static-mark validation; genuine library artifacts and dependency boundaries remain protected. Existing positive preserve-mode fixtures now explicitly select the Ignite runtime instead of relying on the React default.

The focused mutation profile is `pnpm exec stryker run stryker.compiler-entrypoints.config.json`. It covers the Babel entrypoint, TypeScript runtime-selection wiring, and the bundler input filter. It passes at **94.00%**: 47 killed, three survivors, no timeouts, no uncovered mutants, and no errors. The unchanged threshold is 80. The initial broad run scored 60.34%; boundary tests were added and redundant guards around Babel's already normalized hook inputs were removed. Remaining survivors affect plugin diagnostic naming, an unchanged-output reparse, and a redundant directory check for current owned library artifacts. No additional current-candidate failure was found.

Node 22.23.3 / pnpm 10.33.0: package/docs build, 113 plugin tests, plugin typecheck, a strict native Babel `PluginItem` type consumer, NodeNext declarations, strict five-package packed consumers, 169 script tests, runtime tests for 10 example roots, and typechecks for 13 examples pass. The source lockfile is unchanged. The earlier whole-repository formatting limitation still applies; changed-file formatting and repository lint pass separately. Mutation runs took 17 and 11 seconds; the extra run improved boundary coverage. The frozen workspace install reused cached dependencies, and the native Babel type probe installed nine temporary packages. All task-generated dependencies, builds, caches, reports, and probe files are removed before final custody. This is correction evidence, not merge, staging, release, or acceptance approval.

## PR #180 correction — 2026-10-26

Baseline: `d738098106d8ebe58645d8e0968672ff511ce8a9`, tree `7f35edd8f7aae80043507e5954965d61acb805a3`.

`pnpm --filter @ignite-element/jsx-plugin exec vitest --run src/pr180-regressions.test.ts` initially failed all six cases: three unannotated React/Preact/default-runtime builds received author-style objects, and three Babel/TypeScript automatic-runtime builds failed to adopt their emitted mark. `node scripts/verify-packed-consumers.mjs --tarball-manifest <five-entry-manifest>` failed with `reviewed tarball manifest must contain exactly four SHA-256 entries` before reading any tarball.

The regression suite now covers inherited project configuration, Vite/esbuild runtime selection, fallback precedence, moved compiler output, development-runtime output, idempotent adoption, and refusal of dynamic arguments, escaped functions, invalid factories, duplicate children, and misplaced marks. Property runs use seed 180 with 24 and 48 runs. The five-tarball handoff test checks the actual package export shapes and preserves count, order, and digest rejection.

Node 22.23.3 and pnpm 10.33.0: 87 plugin tests pass, strict packed consumers pass for all five release packages, and the selected esbuild/compiler consumer requires no other bundler or Lit installation. The full transform mutation run passes at **82.37%**: 762 killed, 4 timeouts, 141 survivors, and 23 without coverage. The threshold remains 80. An initial 76.91% run led to additional boundary tests; remaining survivors include redundant AST guards and existing out-of-scope branches, and no additional current-candidate failure was found in the correction review.

Local validation uses a disposable npm cache. A pre-existing release-test assertion compares temporary paths literally, so its profile uses a canonical temporary directory. Vite development fixtures likewise use their canonical temporary root; a minimal Vite reproduction without this plugin established the alias mismatch. No security assertion or production guard was weakened. Raw logs, mutation reports, dependencies, and generated builds are not part of the correction commit.

`workflow_improvement`: the repository-wide formatter reports five unchanged baseline files (`examples/agents/smart-home/src/commandApproval.property.test.ts`, `packages/ignite-element/src/jsx/index.ts`, `packages/ignite-element/src/tests/renderers/jsxXss.test.ts`, `packages/ignite-renderer/src/jsx/index.ts`, and `packages/ignite-renderer/src/renderers/ignite-jsx.ts`). These are outside this three-finding correction. Changed-file formatting is checked separately; this receipt does not claim that the repository-wide formatting gate passes or that the candidate is approved for staging or merging.

These titles are the ones that failed when the current tests were run against an older tree. The fixes in this branch were not present for those runs.

## `6f38058e` — 9 of 17

Command, in a detached worktree at `6f38058e2e6b2ce851f35943191384e6f92e80f9`:

```sh
cd packages/ignite-element
pnpm exec vitest --run src/tests/renderers/authorStyleGold.test.ts src/tests/renderers/rendererMutation.test.ts
```

Result: 9 failed, 8 passed (17). Gold 7 of 10. Renderer mutation 2 of 7.

`authorStyle.ts` does not exist at that commit. The gold file was copied in and pointed at the mark that did exist: `trustedStyle` and `readTrustedStyle` from `xssGuard.ts`. `author: true` was passed through as `trusted: true`, which is the flag that commit's `styleSheetFromChildren` reads. The second-copy import loaded `xssGuard.ts?copy=second` and called `trustedStyle`. That adaptation stayed in the worktree. It is not part of this commit.

### Gold failures (7)

- `app entries export none of trustedStyle, safeUrl, safeSpread, or igniteAuthorStyle` — `Object.keys` of the JSX entries included `trustedStyle`.
- `text is not applied on a div or a script` — `getAttribute("text")` was `"x"`.
- `relList is not applied on a div and a stylesheet link is still omitted` — `getAttribute("rellist")` was `"stylesheet"`.
- `unmarked style drops url and import and warns that the plugin may be off` — the warning was not the plugin-off sentence.
- `interpolated url is dropped and dev warns to use a css variable` — the warning was not the CSS-variable sentence.
- `a custom property carries data not a load` — the warning was not the CSS-variable sentence.
- `a mark does not keep script or breakout` — the marked sheet still contained `expression`.

### Renderer mutation failures (2)

- `drops an old id and leaves rel alone when relList leaves the props` — `rel` was `"noopener"`, not `"nofollow"`.
- `uses the remote sentence for url() and the scheme sentence otherwise` — a `url()` value did not warn with the remote sentence.

### Passed at that commit (8)

- `string handlers die and a function inside a spread still runs`
- `untrusted style drops loaders and scriptable tokens`
- `a forged brand and a second copy fail closed`
- `keeps a safe style child when a style element is rewritten`
- `warns when a script or a stylesheet link is not created`
- `does not apply markup sink props`
- `treats null and false hrefs as drops and a boolean true as a blocked url`
- `does not call setProperty again when a style declaration is unchanged`

## `ddc3853d` — direct eval

`git show ddc3853d:packages/jsx-plugin/src/transform.ts` and `git show ddc3853d:packages/ignite-renderer/src/renderers/jsx/THREAT-MODEL.md`, run with `node --experimental-strip-types`.

The threat-model line was: "A direct `eval` of the bundled module can replace a marked binding after the plugin has run." It does not say that esbuild emits the marked `const` as `var`, and it does not say that user CSS written into that binding is trusted. `states that direct eval makes a marked const assignable` fails on that text.

The same source still emitted `igniteAuthorStyle(sheet)` for a `const` in a scope that contains `eval(...)`. `does not mark a binding in a scope that contains direct eval` fails on that output.

## Tests in this commit

`packages/jsx-plugin/src/review-findings.test.ts`

- `states that direct eval makes a marked const assignable`
- `does not call babel or typescript enough on their own`

`packages/jsx-plugin/src/transform.test.ts`

- `does not mark a binding in a scope that contains direct eval`
- `fails when a free reference uses the generated marker name`
- `rejects a template whose static parts name the author mark`
- `rejects a specifier that only matches the author-style text`
- `does not treat an ordinary call as an author import`
- `still marks a const when eval is optional`
- `rejects a Babel ImportExpression that names the author mark`

`packages/jsx-plugin/src/route-closure.test.ts`

- `P2-4: rollup and node-resolve build installed tarballs and keep author CSS`
- `rejects an esbuild template import that names the author mark`
- `does not trust a bare igniteAuthorStyle call on esbuild, vite, or webpack`
- `does not let a src symlink or a bundler alias mint author trust`
- `does not let webpack require.context mint author trust`
- `resolves the mark from a nested install and does not keep a directory symlink`

## `5a91ff50` — still open before this commit

These failed when run against `5a91ff5059ab137d88b1f08ae4a78d680ab7acb1`, then the fix landed in the same commit.

`packages/jsx-plugin/src/transform.test.ts`

- `rejects a template when its resolved files include the mark`
- `allows the renderer source import of ./authorStyle`

`packages/jsx-plugin/src/review-findings.test.ts`

- `P2-5: babel-only and tsc-only fail the build with a clear error`

`packages/jsx-plugin/src/closure-followup.test.ts`

- `P2-1b: esbuild rejects a template whose resolved files include the mark`
- `P2-1c: esbuild refuses an alias to the mark in a file that has a static style`
- `P2-6: the shipped reader is a static private import with no resolver`
- `vite and esbuild drop a style load in the browser`

## `8018afd9` — app package fields that symlink the mark

These failed when run against `8018afd98f7ba225f4dcf7655078cf8c2d03aaac`, then the fix landed in the same push.

`packages/jsx-plugin/src/closure-followup.test.ts`

- `a dependency's fake ignite-element package cannot trust url() or @import`

Variants `evilmark main`, `evilmark2 exports`, and `evilmark3 module browser`. Each app file has a static `<style>` and imports `igniteAuthorStyle` from a helper whose `main`, `exports`, or `module`/`browser` field is a symlink to the real mark. Vite production, Vite dev, and Rollup kept the attacker `url()`. esbuild and webpack already refused them. A symlink field is not an ignite library root, and the issued mark path is not a follow-up for a different import.

## `1aa09e3d` — call capture and symlink marks

These failed when run against `1aa09e3d94558ad25da3c8ce3d66c9be071061ef`, then the fix landed in the same commit.

`packages/ignite-element/src/tests/renderers/authorStyleGold.test.ts`

- `a later Function.prototype.call patch cannot mint trust`

`packages/jsx-plugin/src/closure-followup.test.ts`

- `a dependency's fake ignite-element package cannot trust url() or @import`

The relative re-export stayed refused. Vite still trusted a dist symlink, a self-reference subpath, and a helper `main` symlink. Vite and Rollup trusted `#author-style` when that import pointed at a symlink, in production and development. esbuild and webpack already refused them.

`Function.prototype.call` captured at load measured 7509 B no-host gzip level 6 and 8767 B consumer gzip level 9 on Node 22. Both sit under Jose's Oct 24 2026 ceilings of 7,525 B and 8,800 B.

## `adeb7c59` — fake nested ignite-element

This failed when run against `adeb7c5940856d15b5cc85ee0eda327b3d9de661`, then the fix landed in the same commit.

`packages/jsx-plugin/src/closure-followup.test.ts`

- `a dependency's fake ignite-element package cannot trust url() or @import`

Vite, Rollup, and webpack kept the fake package's `url()` and `@import`. esbuild already refused it. The importer is trusted only for the mark inside its own resolved package root.

## `244c64d3` — outline registry and esbuild glob writes

These failed when run against `244c64d3ea109581a14533299907dae36f83132f`, then the fix landed in the same commit.

`packages/jsx-plugin/src/closure-followup.test.ts`

- `author outline-style solid stays applied across xstate and the index entry`
- `esbuild writes no output when a ternary or template branch globs the mark`
- `the renderer tarball omits the dead author-style-read file`

Held back: capturing `Reflect.apply` for `WeakSet.prototype.has` / `add`. No-host gzip 6 went from 7491 to 7498. Consumer gzip 9 went from 8748 to 8763, which is over the 8750 cap.

## `d710ff82` — still open before this commit

These failed when run against `d710ff82b20cba80135717e31f2a5da77608720b`, then the fix landed in the same commit.

`packages/jsx-plugin/src/transform.test.ts`

- `does not trust a package.json name outside the resolved renderer`

`packages/jsx-plugin/src/closure-followup.test.ts`

- `esbuild metafile rejects a variable directory and a string concat import of the mark`
- `a fake package.json named @ignite-element/renderer cannot mint trust`
- `an app import of @ignite-element/renderer/jsx/author-style-read fails`

`packages/ignite-element/src/tests/renderers/authorStyleGold.test.ts`

- `a forged brand and a second copy fail closed` (WeakSet.prototype overwrite mints trust)

`scripts/__tests__/nodenext-declarations.test.mjs`

- `published declarations resolve under node16 and NodeNext`

`scripts/__tests__/trusted-style-registry.test.mjs`

- `keeps a compiler mark in the packed element build and fails closed otherwise`
