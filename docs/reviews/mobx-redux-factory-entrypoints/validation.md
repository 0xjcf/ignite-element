# Dedicated MobX and Redux factory entrypoints

## Candidate scope

Local branch: `fas/mobx-redux-factory-entrypoints`.
Parent: `1787b4e9d4974ccbc425a4c5802dc7226a6bc410`.
Parent tree: `039ff6bb159188ce20a969adbf676c16b72bd04d`.
The authenticated remote beta still matched this parent at final validation.
The final commit/tree and reconstructable patch are in the accompanying receipt.

Dedicated `ignite-element/mobx` and `ignite-element/redux` factory inputs may
omit `adapter`. Matching explicit discriminators remain supported; mismatched
ones fail strict type checks. Exported configuration names remain compatible.

The internal dispatcher imports constrained configuration types through its
internal barrel. Its ambiguous factories still require a discriminator.
The public root remains source-free, with type and runtime rejection of source
configurations whether or not they include `adapter`.
No dispatcher, helper, package or native entrypoint was added to public exports.

MobX has a specific instance overload to preserve contextual inference for an
inline `makeAutoObservable(...)` expression. The factory/annotated configuration
overload preserves source, states and command inference without explicit generics.
Simply making the old factory discriminator optional broke that instance case;
the existing strict type test caught it before candidate validation.

Redux retains its existing resolved command interface: action dispatch returns
`void`; the facade does not newly expose thunk dispatch. Middleware configuration
and thunk inference on the original Redux store remain unchanged. Checked factory
commands can return a derived result after dispatch through `getState()`.

## Focused evidence

Before implementation, `pnpm --filter ignite-element exec tsc -p
src/tests/tsconfig.json --pretty false` rejected omitted-adapter MobX and Redux
factories. The MobX factory inferred a callable instead of the resolved store;
Redux reported the missing required discriminator. Test-authoring errors in
initial exact-type assertions were corrected separately; they are not claimed as
product failures. The preserved red log precedes the implementation edits.

After correction, `pnpm --filter ignite-element typecheck` passed, including
strict source tests and browser fixture types. Negative assertions cover invalid
fields/methods/inputs, wrong discriminators, the removed `actor` context, internal
factory ambiguity and source-aware root calls. Exact-type assertions guard against
widening. The same dedicated fixtures are copied into packed no-DOM consumers.

The focused runtime command passed 18 tests in three files. Public omitted-adapter
factories acquire exactly once per connected element, keep same-turn moves,
reacquire on a true reconnect, and stop observing at terminal disposal. Shared
instances propagate updates to both views and remain usable after disposal.
Invalid MobX factory results and unsupported Redux values retain runtime rejection.

## Candidate validation

Toolchain: Node `22.16.0`, pnpm `10.33.0`, TypeScript `5.9.3`.
Dependencies installed with `pnpm install --frozen-lockfile`; lockfile unchanged.
Lockfile SHA-256: `af89205aefb83cebc12e1c31cceeaef878b9251c27a71fe994a35942248f7455`.

| Command / profile | Result |
| --- | --- |
| `pnpm --filter ignite-element... build` | All four packages, declarations and exports passed |
| `pnpm --filter ignite-element typecheck` | Strict package/source/browser types passed |
| `pnpm verify:packed` | Nine ESM/declaration/optional-peer lanes passed; both factory fixtures compile through emitted public declarations with `skipLibCheck: false` |
| `pnpm architecture:check` | Passed |
| `pnpm typecheck:full` | Packages and 13 standalone example projects passed |
| `pnpm test:coverage` | 785 tests in 72 files passed |
| `pnpm test:node` | 9 tests passed |
| `pnpm test:scripts` | 147/148 initially; the affected 54-test file subsequently passed with canonical tool executables and temporary paths; see below |
| `pnpm test:examples -- --require-covered-packages-match-discovered` with the ten explicit package coverage arguments | All 10 discovered runtime example roots passed |
| Chromium: `factory-entrypoints.spec.ts`, `existing-sources.spec.ts`, `source-free-core.spec.ts` | 7 tests passed, including MobX/Redux factory and shared lifetimes |
| docs-site `check:primary` | Packed web, native isolation/Jest and exact linked MobX README passed; historical registry beta.14 quickstart also passed |
| docs-site `check:docs` | 31 complete snippets checked, one identified fragment skipped, zero baselined failures |
| docs-site `check:publication`, `check:astro` | Passed; Astro zero errors/warnings, one existing hint |
| docs-site `build`, `check:versions:built`, `check:links`, `check:handbook` | 68 pages; 3,070 references; 23 legacy mappings; agent exports passed |
| docs-site `check:contrast` | 52 contrast checks across both themes and 10 control geometry checks passed |
| `pnpm lint`, `pnpm format:check`, `git diff --check` | Passed |

The initial script failure was an existing test harness assumption: it runs the
resolved npm executable through Node, but Volta supplied a shell launcher.
Using only Node's bundled npm exposed Volta's pnpm PATH rewriting and macOS's
`/var` versus `/private/var` path comparison. The complete affected test file then
passed 54/54 with Node's direct bin directory, pnpm 10.33.0's direct bin directory,
and `TMPDIR=/private/tmp`. This used npm 10.9.2 bundled with Node 22.16.0.
No repository test, assertion, release script or workflow was changed for this.
This is a `workflow_improvement` for portable test-tool discovery, not a current
library failure. No package release operation was performed.

## Package and runtime evidence

The strict fixtures consume `ignite-element/mobx`, `ignite-element/redux`, and
the existing scoped adapter factory exports. The root packed lane additionally
rejects factory source configurations with and without explicit discriminators.
Packed consumers install local tarballs, with provenance checks and no workspace
path aliases. The primary web consumer compiles both complete handbook factory
examples and the actual MobX README. Native declarations use the existing neutral
imports and do not acquire a new platform path.

Tarballs retain the baseline `3.0.0-beta.14` version labels because version
preparation is excluded. They are locally built candidate artifacts, **not** the
published beta.14 package. Their SHA-256 manifest accompanies this receipt.
Historical beta.14 source and its registry-backed lane are unchanged.

A baseline build and candidate build produced 48 production JavaScript files
across the four packages. All filenames and SHA-256 hashes matched. Changes are
types/signatures, tests, examples, focused guidance and an unconsumed patch
changeset. No adapter execution, acquisition, effects, event or disposal code
changed. Public exports, root validation, lockfile, governing agreement and
workflows are unchanged.

## Custody and review boundary

See [documentation reconciliation](./docs-reconciliation.md) for exact parked
identities and the remaining page-review checkpoints. Neither parked worktree
was modified. No push, PR, merge, version preparation, staging, publication,
dist-tag change or documentation deployment is authorized by this candidate.
The new changeset is unconsumed and is not evidence of release readiness.

Normal lint and commit-message hooks are required for the local candidate commit.
Task-created dependencies, build output, coverage, browser results and caches are
removed from the task worktree after validation and commit. A bounded external
review packet retains the patch, identities, sanitized validation logs and packed
input hashes, not dependency trees or a duplicate Git history.
