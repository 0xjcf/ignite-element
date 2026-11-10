# Workspace author-style build correction receipt

Date: 2026-10-28. Status: fixed and independently reviewed locally; uncommitted.
The stage-one voice-workbench production-build limitation is resolved. Stage two
has not started. No integration, publication or acceptance occurred.

## Authority and custody

The Operator chose to address the limitation before stage two and instructed:
“great let's do this now.” The bounded correction manifest retained the existing
worktree and seven preservation rules, authorized plugin resolution, regressions,
necessary build configuration, changeset/receipt, frozen installs, TDD,
fast-check, focused Stryker, build/browser/packed/bundle checks and final read-only
review. No public API/security-policy change, stage-two refactor, commits, pushes,
merges, releases, secret access or application provider calls were authorized.

Repository: `0xjcf/ignite-element`; branch: `codex/remove-projection-targets`.
HEAD remains `4d191949c861ab0b72844574604906fc937c0694`; base tree remains
`2672968d2b1b9f37dbf9ce250060496728d85ae3`.

The prior 57 stage-one changed/new/deleted files remain byte-identical, including
its historical [receipt](projection-target-removal-stage-one.md). The additive
correction reviewed six files:

- `packages/jsx-plugin/package.json`
- `pnpm-lock.yaml`
- `packages/jsx-plugin/src/workspace-provenance.test.ts`
- `packages/jsx-plugin/vitest.provenance.config.ts`
- `stryker.workspace-provenance.config.json`
- `.changeset/workspace-renderer-provenance.md`

The reviewed **63-file uncommitted candidate** has sorted filename/content-SHA256
record digest `c55866d8fbce8587d8b656718d84213b2c72b951e8f95a97f4c35450d6634045`. Record values are file SHA-256 or `deleted`, hashed as
a compact JSON array sorted by complete filename string. This subsequent receipt
is excluded. The main checkout and dirty workout demo retain their prior states.

## Root cause and correction

The source JSX plugin resolves the renderer from its own package to establish
library ownership. Its renderer development dependency was undeclared. pnpm's
Vitest shim supplied the current workspace renderer through `NODE_PATH`, masking
the omission. The isolated example's shim instead supplied its older installed
renderer while Vite aliases selected current workspace source. The provenance
guard correctly rejected that ownership mismatch.

The correction adds **one development dependency**:
`@ignite-element/renderer: workspace:*`, plus its exact workspace lock link.
There are no resolved-version changes. Frozen installation passed. Current root
lock SHA-256: `26985c470bc1ad785101fa98064194e4fe10c8f3e8ed72123a65f08ab695edc2`.

No production TypeScript/JavaScript, renderer guard, compiler rule, runtime
dependency, export or public API changed. No broad filesystem trust rule, alias,
public option or guard bypass was added. The patch changeset is unconsumed and
contributes to a later prerelease; it does not establish publication readiness.

## TDD and properties

The actual example production build first failed on `renderer.ts` importing its
own `./authorStyle`, with the existing “cannot mark CSS” provenance diagnostic.
Three native-process regressions then failed before the metadata fix: native
renderer resolution, bundled example configuration, and a source-aliased consumer
build. The owner/name/path preservation properties were green on the baseline.

The tests deliberately clear `NODE_PATH` in their child processes, exposing native
owner resolution instead of inheriting the test runner's hoisted packages. This
is test isolation; production environment handling is unchanged.

After the declared dependency and frozen install, those three regressions and the
full example build passed. Mutation testing prompted additional assertions for
compiler bridges, absent/shim/sibling/symlink importers, cross-package registries,
a second element installation, source-vs-dist ownership and malformed exports.
The source guards already rejected those inputs; assertions were strengthened,
not weakened.

Fast-check seed **1801029**, **60 runs each**, covers legitimate renderer imports
across request/query forms and forged application package names, paths and bridge
requests. Native CLI output is executed in JSDOM to verify that static author CSS
survives while dynamic untrusted remote CSS is omitted, using the same registry.
The final focused profile contains nine tests.

## Final validation

| Check | Result |
| --- | --- |
| Frozen workspace and isolated example installs | Pass |
| Framework package build and JSX-plugin build | Pass |
| Voice-workbench production build | Pass; approximately 0.73 seconds |
| Plugin source and strict test typechecks | Pass |
| Full compiler-plugin suite | 167 passed, including real Chromium and packed/plugin security cases |
| Voice-workbench runtime and DOM suite | 311 passed |
| Packed consumers, optional-peer/no-Lit/export/strict declaration checks | Pass |
| NodeNext declaration profile | Pass |
| Existing budget and built-host regressions | 14 passed |
| Architecture boundaries, changed-file Biome, Markdown, whitespace | Pass |
| Production page in local Chromium | Pass |

Production browser evidence: real built page, shadow DOM, 16 buttons, one author
stylesheet, computed `display: block` and expected `--foreground` value, zero
page errors. All off-origin traffic was intercepted/aborted; no provider call was
made. This checks production rendering and styles, not live model/speech-provider
integration. The temporary browser and localhost server were closed.

Commands included `pnpm --dir examples/agents/voice-workbench build`,
`pnpm --filter @ignite-element/jsx-plugin build`,
`pnpm --filter @ignite-element/jsx-plugin typecheck`,
`pnpm --filter @ignite-element/jsx-plugin test`, `pnpm verify:packed`,
`pnpm check:nodenext`, and the focused Vitest/Stryker configurations. Existing
packed-profile no-lib-DOM diagnostics remain explicitly non-gating and unchanged.

Toolchain: Node 22.23.3, pnpm workspace 10.33.0, TypeScript 5.9.3, Vite 7.3.7.

## Mutation result and limits

`pnpm exec stryker run stryker.workspace-provenance.config.json` challenges the
existing owner-resolution helpers in `unplugin.ts`, lines 198–269. Stryker does
not mutate JSON development-dependency metadata; the missing edge is demonstrated
by the native-process red/green evidence above. No production helper was changed.

Final result: **66 mutants, 53 killed, 12 survived, one uncovered, zero timeouts or
errors; 80.30% total, 81.54% covered score**. Incremental reuse and static-mutant
ignoring are disabled; no mutants are suppressed. The nightly profile and bundle
budgets remain unchanged.

Survivor triage:

- Catch fallthrough producing undefined instead of null is equivalent for current
  nullish/truthiness callers.
- Recomputing immutable package-root caches is a performance variation.
- Exact equality to the package directory and redundant missing-importer/owner
  guards are not distinguished for admitted absolute module-file callers.
- Some `knownElementRoot` cache/fallback variants remain undistinguished by this
  focused profile; equivalence in arbitrary environments is not claimed.
- A null-owner boolean branch remains uncovered under the installed dependency
  setup. This is a remaining coverage limit, not evidence of complete proof.

`non_blocking_hardening`: additional isolated fallback/null-owner mutation coverage
could improve the unchanged resolver's assurance. Full compiler and packed tests
pass; this is not a reproduced introduced candidate failure. No score threshold
was waived or invented. The result is neither a whole-plugin mutation score nor
100% security coverage.

Initial harness dry runs exposed test-selection/dependency-root setup issues;
those were corrected before recording mutation results. Mutation-directed tests
increased kills from 32 to 53. No application or security implementation was
changed to make the harness pass.

## Bundle checkpoint and declaration identity

The packed fixture checkpoint was repeated with the same Node/Vite/esbuild,
production ES2020 target and external optional peers. All values match stage-one
checkpoint B exactly:

| Fixture | Gzip bytes |
| --- | ---: |
| XState headless | 21,826 |
| XState DOM | 21,916 |
| XState hook | 21,955 |
| Neutral tools | 4,058 |
| Existing no-host renderer, gzip 6 | 7,524; cap 7,525 |
| Existing renderer consumer, gzip 9 | 8,778; cap 8,800 |

Headless minified bytes remain 64,689. The approximately 25% stage-one reduction
from 29,047 gzip bytes is retained. Every JavaScript and declaration graph hash
for core/adapters/renderer/ignite-element matches the stage-one receipt
byte-for-byte. No runtime bundle dependency was added.

## Independent review and final custody

The final read-only Codex review returned **no actionable introduced findings**.
It confirmed that the workspace dependency fixes owner resolution without changing
runtime dependencies, provenance guards or public contracts, and explicitly noted
incomplete focused mutation coverage. It inspected the authenticated six-file
correction and recorded evidence; it reran no checks and authorized no integration,
publication or acceptance.

All task-created worktree dependency directories, dist/declaration output,
build-info, mutation sandboxes/reports, native fixtures, audit tarballs, local
caches and task logs were removed after recording this receipt. The prior 57
source files and the reviewed six-file correction retain their identities; this
receipt is the sole subsequent source addition. No pre-existing ignored output
existed in the isolated worktree. Shared caches and other worktrees were preserved.

No commits, ref changes, pushes, merges, releases, provider calls or lifecycle
changes occurred. Stage two remains unstarted. The candidate remains available
as uncommitted source for Operator review.

Workflow cost: frozen installs reused cached packages and added only the workspace
link. Native process checks prevented the hoisted-path false green. Final focused
checks took about a second, the complete compiler suite about four seconds, and
the final mutation pass about eight seconds; repeated passes addressed real
mutation survivors or harness setup. Browser IPC required normal sandbox
escalation, with no additional user approval interruption. Raw logs/reports were
temporary; their hashes follow.

## Evidence hashes

```json
{
  "red-build": "c88bd51aacfb5d9ef02107af70b6abd79428081d67a8fe15f3bd966396f9b56f",
  "red-tests": "7a7b3b0ec5654a182baff3cad954310ae8b936cbfe823b4b9ea4fd27f2afe697",
  "green-build": "c2e4bff809a707f5d5bee269c5eba50930d8591434742c7dd770f414a16cdf99",
  "mutation-profile": "4a91b570cae89b710bda9af844638e99728a6bbb43a33cf1abcf46e3c2670826",
  "package-tests": "a3adc8576c0261f5f8270f0515a9fa31c2d7ccd05cb7359a79e6721850e161d3",
  "voice-tests": "b2a79e5e1a8417614041ff130e7d86d6cfe997e1161e58bc59c113b1d93dc28c",
  "packed": "10eaae5b93bada03512295141f44d97e335781ebc7bdd2a69563cf15e9ad4c17",
  "nodenext": "c8e9e523660dcb9cae5771d3012534264289916c5642d9179ab6b96e000eef3f",
  "final-types": "d74a3777bec130bbe6c701435a35b40dac80db45472f1d28be5532fbfa4302a2",
  "browser": "90801579c879deea89588decf6c80d44b3b175522ee6fd342198e8d29aad0ee4",
  "budget-tests": "0ccb014b45179acff7fb1d4c24c4386c3066d4927f67d58acd92bae856d3fe6d",
  "mutations": "0de58146f4811cb21be5ca1e7243d4453490578532dea31e8ee957c6196d6dd2",
  "markdown": "0897226227fcd72300e912daac90b64f9d6c335a51b0bef485f4a671b56ed020",
  "review": "4379bf4e6adcde0cc34700544d083442c81ffe0404eb3b0a39de51d8c56c72c3"
}
```
