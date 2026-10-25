# Fail-first tests

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
