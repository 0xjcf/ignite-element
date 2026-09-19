# Getting started — lifecycle reconciliation checkpoint

Status: **ready for Operator/Navigator re-review; not accepted or published**.

## Candidate and custody

The 2026-09-19 release prompt authorizes this recoverable successor and requires
stopping after Getting started. Sources remains awaiting review; Views is queued.

- Original parked page refinement: `1cfc2310557e9ed602c6e7f9524e9827e45f4dbc`.
- Original parked Getting started: `d46c0cd9a514b645e72c3ba3dc65d2f9d9636ad1`.
- The former is an ancestor of the latter. Both original branches are preserved.
- Accepted beta: `4e1441ead1f91d4f6de60ab0f4187bcee59c9a21`, tree
  `be1293c5d8b248a9310d3da99ee1132cceb137da`.
- Separate baseline reconciliation: `ae22191aa9a739a8573860b7778393d19fbd41da`,
  tree `47599ee1ec101ce3f4816cdc47a079e3d5d580e5`.
- Successor branch: `task/docs-getting-started-lifecycle`.

Five prose conflicts were resolved by retaining parked editorial structure and
merged lifecycle semantics. The retired shared-readiness route remains a redirect.
Package implementation and native fixture files match accepted beta. The parked
lockfile and documentation demo dependencies are preserved; no dependency or
release metadata changed in this checkpoint. The final commit/tree and diffs are
recorded in the external validation receipt to avoid self-referential hashes.

## Page changes

The complete XState light-switch source is unchanged: public imports, inline
`states`, commands receiving `{ source }`, `ctx`, JSX pragma, stylesheet, custom
element registration and HTML mounting remain the canonical displayed/live/ZIP
example. A brief notice identifies the unreleased API and qualifies installation
and download instructions. The ZIP README carries the same limitation.

The directly linked API table no longer advertises `cleanup`. Compatibility no
longer requires independent-hook preparation reads, and distinguishes React DOM
19.2.7 Activity evidence from React 19.1.0/RN 0.81.5 native-host evidence. Ownership's
summary table includes automatic private-runtime release. These are narrow link
dependency corrections; they do not constitute acceptance of those pages.

The earlier publication-copy guards rejected the newly authorized notice: the
initial publication run had 48 failures from that shared precondition. The guards
now require the preview notice, beta.14 distinction and conditional installation.
Three negative fixtures prove those disclosures cannot silently disappear. They
still reject internal release instructions in the quickstart. The generated agent
export must carry the same preview distinction. No assertions were suppressed.

## Fresh verification

Node 22.16.0 and pnpm 10.33.0; frozen workspace installation (8.1 seconds).

| Check | Result |
| --- | --- |
| Four package builds and public export verification | passed |
| Package strict typecheck | passed |
| Packed documentation web consumer | strict declarations, `skipLibCheck: false`, isolated resolution; 8 tests passed |
| Packed documentation native consumer | strict no-DOM types, dependency isolation; 5 tests passed |
| Exact light-switch standalone preview | isolated candidate tarballs, strict typecheck, Vite build passed |
| Published beta.14 historical control | independent registry install without candidate overrides; strict typecheck and 1 test passed |
| Standalone native fixture runner | fresh isolated install plus frozen reinstall, isolation/typecheck and 5 tests passed |
| Documentation snippets | 29 blocks typechecked; 1 existing fragment and 7 explicitly excluded blocks separately accounted |
| Publication/routing suite | 302 tests passed; publication permission contract passed |
| Astro check | 0 errors, 0 warnings, 1 existing unused-variable hint |
| Site and generated agent exports | built; 69 routes and 29 legacy mappings verified |
| Handbook tests, links, anchors, assets | 8 tests and all relevant checks passed |
| Canonical ZIP/export identity | all five ZIP files and displayed source match; preview README included |
| Shared presentation | 60 page/theme/viewport cases; 66 contrast checks; 13 native control geometry checks passed |
| Browser interactions | light switch click/keyboard and count; copy feedback; stable-version navigation and Back passed |
| Harness interactions | exact copied code, menus, selector keyboard navigation, version round trips, table/code scrolling passed |
| Formatting | changed JavaScript passes Biome; normal commit hooks pass |

The first visual test launch was blocked by macOS sandbox process registration.
The authorized unsandboxed repository test passed. In-app large-viewport captures
showed compositor stitching artifacts, so requested review captures come from the
existing repository visual test's screenshot mode. That extra run also passed.
Desktop 1440px and mobile 390px captures cover both themes and expanded sections.
Shared header/TOC alignment, caret/focus styling and table grids already pass; no
new shared styling change was necessary.

The external evidence directory `ignite-docs-lifecycle-review-20260919` retains
logs, input hashes, isolated consumer provenance, screenshots, diffs and a static
preview. The companion consumer directory is identified in `primary.log`.
Build/dependency output created in the new worktree is disposable and removed
at handoff; original parked output is untouched. Review evidence and the static
preview are deliberately retained for this checkpoint.

## Reproduce

From this candidate checkout:

```sh
pnpm install --frozen-lockfile
pnpm --filter ignite-element... build
pnpm --filter ignite-element typecheck
pnpm --filter docs-site check:primary
pnpm --filter docs-site check:docs
pnpm --filter docs-site check:publication
pnpm --filter docs-site check:astro
pnpm --filter docs-site build
pnpm --filter docs-site check:versions:built
pnpm --filter docs-site check:links
pnpm --filter docs-site check:handbook
pnpm --filter docs-site check:contrast
pnpm --filter docs-site preview --host 127.0.0.1 --port 4346
```

The standalone native runner accepts a new external directory:

```sh
node scripts/__tests__/fixtures/react-native-bindings/run.mjs /tmp/ignite-native-review
```

Local tarballs retain the repository's pre-release-preparation beta.14 metadata;
they are candidate bytes, not the public beta.14 artifacts. Provenance hashes
and isolated manifests distinguish these lanes. The ZIP's `beta` dependency
still resolves the published version today; it is not yet a runnable public
installation of the candidate. The live and packed candidate previews are usable.

## Queued page and release work

- Sources: review source-native snapshot shapes, factory safety and independent
  hook wording; reconcile its installation guidance at its own checkpoint.
- Views: review independent/shared examples, Web Component/ref interoperability,
  synchronous context and Activity behavior. Preserve the accepted live demos.
- Ownership: reorganize the retained isolated-headless heading and review all
  lifetime wording without reintroducing preparation reads or early cleanup.
- Events, Testing, API and Examples: continue the existing A01–A12/E01–E10 ledger;
  retain explicit tool-schema descriptions and label fragment prerequisites.
- Supporting destinations: preserve historical beta.13 labeling and stable-v2
  APIs; review the insertion-effect/test-renderer compatibility distinction.

No later-page editorial review was completed. The previously accepted runtime
suite and CI are historical evidence with their original inputs, not fresh final
release gates. The 12 disclosed baseline import-order errors remain outside this
scope; full-repository formatting is not claimed green.

Registry preflight still shows beta.14 for all four beta tags, scoped `latest`
beta.14 and facade `latest` 2.2.2. No next version was selected, changeset consumed,
stage authenticated/dispatched, package published, branch pushed or docs deployed.
Manual deployment and protected staging workflows remain unchanged. Stage review,
public provenance checks and final release CI belong to their later checkpoints.
