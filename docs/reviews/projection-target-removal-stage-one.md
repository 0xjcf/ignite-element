# Projection target removal: stage-one candidate receipt

Date: 2026-10-28. Status: implemented and independently reviewed locally;
not integrated, accepted, committed, or published. Stage two has not started.

## Authority and identity

The Operator approved stage one and all seven preservation rules: retire the two
target factories and `core(target)`, migrate voice-workbench, remove orphaned
machinery, preserve retained APIs and security, and validate with TDD, seeded
fast-check, focused Stryker and a final read-only Codex review. No application
provider calls, credentials, commits, pushes, merges, releases or lifecycle changes
were authorized or performed.

- Repository: `0xjcf/ignite-element`; branch: `codex/remove-projection-targets`.
- Base and unchanged HEAD: `4d191949c861ab0b72844574604906fc937c0694`.
- Base tree: `2672968d2b1b9f37dbf9ce250060496728d85ae3`.
- Candidate: **uncommitted**. The reviewed 56 changed/new/deleted files have the
  sorted content-record digest `72d7874fa1b5c4a73d36663da3a2c95db2543285531faac2989ae9deae166bab`.
  Each record contains a repository-relative filename and SHA-256 of its content,
  or `deleted`; the digest hashes the compact JSON record array. This receipt is
  subsequent closeout documentation and is excluded from that review identity.
- Root lockfile unchanged: SHA-256
  `3a8ae24edac82d745241c28081a8badf0d393f9c345754e2935c0c3ae966f160`.
- Example lockfile: SHA-256
  `799cfa040d09714ee8e78dfcf83fc9bff1ec06a09e580b0b2b5b0c1f16a9feb1`.
  It adds test-only fast-check 4.10.2 and pure-rand 8.4.2 using the exact existing
  workspace lock records; frozen installation passed without version resolution.
- Toolchain: Node 22.23.3, workspace pnpm 10.33.0, TypeScript 5.9.3, Vite 7.3.7.
  The example's direct frozen install used its existing pnpm 10.15.1 environment.

## Public API and ownership

Removed `createProjectionDocumentTarget` and `createProjectionSpeechTarget` from
root, XState, Redux, MobX and Actor-Web entrypoints. Removed the shared
one-argument core overload, branded target/session types, target configuration,
inspection/serialization and delivery binding paths. Invalid one-argument calls
fail before inspecting application data. No public subpaths or replacement APIs
were added. Other public runtime, React, tool, renderer and adapter APIs remain.

Voice-workbench now owns its semantic document types and strict parser. Its
private observer uses ordinary `watch`, coherently reads projected documents and
availability, selects the first document, serializes/coalesces commits, deduplicates
revisions, reports failures and retries on a later notification. Failed subscription
installation cancels queued delivery; disposal releases observation. Source-native
speech statecharts, correlated delivery/acknowledgement, cancellation, replay and
application ports remain unchanged. The application owns I/O and source shutdown.

Canonical descriptor-based plain-data validation, semantic field allowlists,
command/schema/availability checks and executable-data/URI rejection remain at the
application boundary. Payload checking uses the existing supported `resolveCall`
API rather than a private framework import. Renderer URL/CSS guards and author
provenance logic were not changed. The core's eager JSX registration remains.

Source side-effect metadata explicitly retains DOM host installation, which the
old target inspection had retained indirectly. The built-consumer regression proves
host mount/update, accessible descriptions, stable canvas ref identity, cleanup and
borrowed-source survival. `Host.describe` remains available for DOM accessibility;
only target forwarding is retired. The broader JSX `commit` proposal is not added.

The changeset is **unconsumed**, for a later prerelease: an intentional v3-beta
API removal in ignite-element and a renderer metadata patch. It does not establish
release readiness, publication or architecture acceptance.

## TDD and deterministic validation

Before production changes:

- Six runtime removal assertions failed because factories/target registration were
  still accepted; strict type tests reported four unused `@ts-expect-error` markers.
- Seeded baseline preservation properties passed for canonical document copying,
  stale patch rejection, executable/accessor data rejection and borrowed-source
  cleanup. These establish existing behavior to preserve, not newly shipped APIs.
- The new application-observer tests first failed with its implementation absent.

Additional regressions were red before their corrections: queued delivery after a
subscription install throws, and missing host mounting in the built consumer after
removal. Both are green. No assertions were weakened or tests skipped.

Fast-check seed **1801028**: 100 runs each for document copying/stale patches,
executable/accessor rejection and borrowed-source cleanup; 50 asynchronous generated
revision/notification/disposal traces. The application observer also tests coherent
schema-valid/available actions, invalid catalogs, slow commits, coalescing,
reentrancy, retries, disposal and diagnostic failures.

Final applicable checks:

| Check | Result |
| --- | --- |
| Four-package production/development build and export inventory | Pass |
| Strict source/declaration consumers and NodeNext | Pass |
| Packed candidate consumers, optional peers, no-Lit and negative target types | Pass |
| Element package tests | 1,498 passed; 2 pre-existing todo |
| Compiler-plugin package tests | 158 passed |
| Validation-script tests, including built host regression | 170 passed |
| Real Chromium renderer suites | 38 passed |
| Runtime example roots | 10 passed; 506 tests, including 311 voice-workbench tests |
| Example strict typechecks | All 13 passed |
| Architecture boundaries | Pass |
| Changed-file Biome and Markdown lint | Pass; pre-existing informational lints remain |
| Diff whitespace | Pass |
| Voice-workbench production build | Baseline limitation below |

Representative commands: `pnpm --filter ignite-element... build`,
`pnpm typecheck:packages`, `pnpm check:nodenext`, `pnpm verify:packed`,
`pnpm test:packages`, `pnpm test:scripts`, `pnpm test:examples`,
`pnpm typecheck:examples`, `pnpm --filter ignite-element test:browser`,
`pnpm architecture:check`, and `node --test scripts/__tests__/retained-host-bundle.test.mjs`.

Browser checks required normal local IPC outside the sandbox. npm checks used a
task-local cache; script checks used canonical `TMPDIR=/private/tmp`. No code or
assertion was changed to accommodate those environment requirements. The existing
packed profile's explicitly non-gating no-lib-DOM diagnostic remains unchanged;
this stage does not promise a DOM-free declaration graph.

## Focused mutation testing

`pnpm exec stryker run stryker.target-removal.config.json` mutates the private
application observer, its URI policy, and the migrated public-tool validation
bridge. The nightly renderer mutation profile is unchanged. Incremental reuse and
static-mutant ignoring are disabled; no mutants are suppressed.

Two local passes took approximately 10 and 9 seconds. The first exposed missing
positive action, diagnostics and late-callback checks; those tests were added.
Final: **125 mutants; 111 killed, 5 detected by timeout, 7 survived, 2 uncovered;
92.80% total score**. Nonterminating queue/loop mutants account for the timeouts.

Residual triage:

- Validation bridge: its fixed-name, ungated read manifest can return only an
  InvalidInput error. One conditional mutant is equivalent; two uncovered fallback
  mutations are unreachable. Removing the issue-path regex anchor is equivalent
  because issue strings from this validator always start with `input`.
- Observer: removing the extra disposed callback guard changes no delivered output
  because the drain also checks disposal and legitimate `watch` unsubscribes.
- URI policy: an extra trailing loop entry, replacing null with a scalar blocker,
  and an empty scalar blocker preserve anchored scheme recognition on canonical
  JSON because array entries are comma-delimited. Four surviving mutations cover
  those equivalent behaviors. No arbitrary object coercion is accepted.

This is a focused assurance result, not a claim that the entire framework or
application parser has a 92.80% mutation score.

## Bundle checkpoint B

Paired measurements use actual packed packages, the same Node/Vite/esbuild profile,
production ES2020 output and external optional peers. gzip is level 9 except the
existing no-host budget, which is level 6. Captured in-memory source maps matched
canonical build JS byte-for-byte. Final JS also matched the checkpoint-B packed
JS byte-for-byte after the final build.

| Fixture | Baseline gzip bytes | Checkpoint B gzip bytes | Change |
| --- | ---: | ---: | ---: |
| XState headless commands/watch | 29,047 | 21,826 | -7,221 (-24.86%) |
| XState DOM component | 29,122 | 21,916 | -7,206 |
| XState React hook | 29,174 | 21,955 | -7,219 |
| Neutral tools | 4,056 | 4,058 | +2 (chunk identifier/compression noise) |
| Existing no-host JSX budget, gzip 6 | 7,524 | 7,524 | 0; cap 7,525 |
| Existing renderer consumer, gzip 9 | 8,778 | 8,778 | 0; cap 8,800 |

Headless minified size: **90,723 → 64,689 bytes**. The removed document parser
previously accounted for 13,708 minified bytes, and the binding layer for 3,670.
The remaining headless fixture includes renderer reconciliation (14,685), element
factory (7,721), retained hosts (6,077), XSS guards (5,968), and agent runtime
(4,903). These are minified source-map attribution bytes, not additive gzip costs.

The provisional smaller result that accidentally omitted host installation was
rejected. The table above retains hosts and all required behavior. The combined
core still retains DOM registration/presentation dependencies; internal separation
is stage two and has not been implemented.

The measured headless input constructs a native XState count machine and projects
count through `states`, with an increment command. Its observable output retains
`{ watch: core.watch, execute: core.execute, dispose: core.dispose }`. DOM and hook
fixtures use that same core with JSX registration or `useIgnite`, respectively.
Existing canonical renderer fixtures and budget tests were not changed.

## Independent review and remaining limitation

Final read-only Codex review: GPT-6.1 Sol, CLI 0.165.0-alpha.1.2, xhigh reasoning.
It inspected the exact tracked and untracked candidate and supplied evidence, ran
no tests or mutations, and returned **no actionable introduced findings**. It
supported preservation of the retained contracts and classified the build failure
below as pre-existing, requiring separate authorization for repair. Review does
not authorize integration, acceptance or publication.

`non_blocking_hardening` (pre-existing example build configuration):
`pnpm --dir examples/agents/voice-workbench build` fails with:

```text
renderer.ts: An application import from "./authorStyle" cannot mark CSS.
The ignite JSX plugin marks static <style> text itself.
```

The identical error was reproduced from an archive of the exact approved base's
tracked packages/config/example sources, with the same dependency links. Candidate
and baseline both reach the author-CSS guard through workspace source aliases.
There is no plugin/provenance bypass in this candidate. This is not an introduced
stage-one blocker, but **production-build readiness for the example is not proven**.
Fixing plugin/example build resolution requires a separately authorized scope;
recommend resolving it before claiming production dogfood or beginning stage two.

## Custody and workflow cost

The isolated worktree was initially clean with no ignored output. The main checkout
remains clean at its original branch/HEAD. The workout demo retains its original
package.json delta (3 additions, 2 deletions) and untracked workout example. No
stashes, unrelated worktrees, source lifecycle decisions or refs were changed.
Only the approved branch/worktree creation occurred.

All task-created dependency directories, dist/declaration output, build-info,
mutation reports, fixture archives, audit bundles and task-local caches/logs were
removed after recording this receipt. No pre-existing ignored output was removed.
The review source identity remains intact; this receipt is the sole subsequent
source addition. The worktree and its uncommitted source changes remain for review.

There was one Operator manifest approval and no additional user approval
interruption. Frozen installs reused the workspace cache (the initial root install
downloaded zero packages); isolated examples needed their own dependencies. Focused
checks were subsecond to a few seconds; the final script suite took about 19 seconds
and browser suites about 8 seconds during parallel validation. Repeats followed
new migration changes, mutation test gaps, or required environment access, not ref
name changes. The standalone Codex review took about six minutes. Build artifacts
and large raw reports were temporary; no Git bundle was created. These costs proved
API retirement, peer isolation, retained security/host behavior and independent
review, rather than providing publication or acceptance evidence.

## Content-addressed evidence

Build graph identities hash sorted repository-relative file/hash records; export
identities hash the package `exports` JSON. No credentials or workstation paths
are included. Raw generated reports were removed after recording these hashes.

```json
{
  "@ignite-element/core": {
    "js": "b2c97fc676e4122cbe19c3d4da3e0bfa65689adb5097b3bbb7e2a32e0d2be451",
    "declarations": "21ffdfa04d34c07f19a1c745d2c7fd5d96b939d43e78896266b815882951bae6",
    "exports": "654e375ff6e459bfe58a0633557c9d2cba9637ff6fb875642b916826428c7aa3",
    "declarationFiles": 8
  },
  "@ignite-element/adapters": {
    "js": "7e6ec56240a741cc83e8ccb09a72b74d34a1d5f9bc1fefd92de830152c5d5fdf",
    "declarations": "6ebf87de67f797fa5ff81c64d6a99da7335a850f2226f00b4f10ed00ebcc5145",
    "exports": "727bc5f7210e72102200b2a86244917562e38988ba559931de5c592e3f3fce38",
    "declarationFiles": 15
  },
  "@ignite-element/renderer": {
    "js": "83a05a4886fca3cd2562b4d341e5a87ae3bb12b3379d56a8bc2ff07ad14aa780",
    "declarations": "6dd389d5601f14ed2b0bad6d0ffcd2246fa30f5deb87b6d9b6bf7c92cf789645",
    "exports": "c534aded3d17cde8f6fd72855f7b3d460596e6ddef87982f377cd68fb1d26f82",
    "declarationFiles": 30
  },
  "ignite-element": {
    "js": "db197a6a2289fac85394514924acf476794627f17042a2a5d03f3a31ec47d9f2",
    "declarations": "f556c6794fc526fc6e106db1da12c4df5768281b66d0590bb886883a7726baec",
    "exports": "5e918c07cb414237f509390bf8becbb95b3ae9e393f0dae7a955f6ad8a2b14bd",
    "declarationFiles": 85
  }
}
```

Command-log SHA-256 records (the diagnostics/results are summarized above):

```json
{
  "type-red": "84e47e90c0fa594bbfd542a0fb669d191e217b25ba09c7f4fae69d7b062400c3",
  "properties-baseline": "e9e3b2c3a0cf845ec2f13fe703f3dc2f0164bfdd8d047d7ccd8257b3a6aadb2f",
  "observer-red": "5dd770c261312eaaf16c467c26cf442d59d3f26d672b011ea390dcbd42534f3d",
  "installation-red": "bdf03bd66d00f09731c828ca2e3f2e25d4eeff5a87e76028019f8859c0cfc9d2",
  "host-red": "7f8d1e5a3b1e84859c751d0061d09f8760da40d7763bf3fe5aa1c032ee0c714b",
  "host-green": "70318368e748d86a29273d3905dd035d3fd6a41390751a11edba1a961e075ad2",
  "build-green": "c1560da1a55ad23b0c821a9c70fce12e599efb3676d8448445d74db5da468c33",
  "final-packages": "6d23cd7825c52bfc51ff1b9d9e7898e9d56ecb4667ecdee4ad32cb192228f4c0",
  "final-scripts": "99081a398593f53b590e7b0e87fb3dae3371fb456fb680ecedc8be7b41a0ce4f",
  "final-packed": "9dceafdfe20514812879f673a51f01d3191657ef4a84d6d63d9ef5425e520f21",
  "final-types": "c8e9e523660dcb9cae5771d3012534264289916c5642d9179ab6b96e000eef3f",
  "final-browser": "959522b76b0542907a7a75c5c34754914e288f57c140372db5b6aec252e84afd",
  "examples": "0101def721d77f56186b700e205f87fed762e81a81cbe4d0b70c3022b7a3f1db",
  "example-types": "51ce8b981890ac70819825accd58cf30e9f17516cdcd870fcaa31ba2c7a0af40",
  "mutations": "3d22d7595494ad56358cb5646568aa95a90bb3cb068e25650883fd4852e5fa32",
  "baseline-voice-build": "12e00d7db1e733bf1894dd1bd083e4bb50754da173da46071ebe1a16c057c87b",
  "voice-build": "0bd961171baf9b4a8148ae32f6f0a84e9786e1c6e91d26515b5eb135d4d51dc7",
  "final-biome": "b9bcb8b653272877a56d1ca84b31c04e0aa2f35ff45a50bbbea9a3384a205cf8",
  "markdown": "bb7aad9b53910889b711770f2d56c3aa12e04c0c682624549664a314415cd48b"
}
```
