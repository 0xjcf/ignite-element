# Getting started — source command API preview

Status: awaiting re-review. Date: 2026-09-17. Sources remains awaiting review; Views remains queued. This receipt reopens Getting started only for the accepted command-source API and release boundary. It does not accept subsequent pages.

## Identities and reconciliation

The clean parked branch `fas/docs-page-refinement` remains at `1cfc2310557e9ed602c6e7f9524e9827e45f4dbc`, tree `14689a7da715fa2cfde41745438f7485bbb34b5d`. The original page approval at `7d8e37840bfacb2835bd2f99f2cab5b9e9558275` remains recoverable there.

A separate local successor, `fas/docs-getting-started-source`, reconciles that checkpoint with integrated beta `1787b4e9d4974ccbc425a4c5802dc7226a6bc410`, tree `039ff6bb159188ce20a969adbf676c16b72bd04d`. The baseline reconciliation is commit `491a79d20d74fdd5f04816e5978910113526c541`, tree `d724bd16e477ad9a62a34948751c4bbac15c957f`. The next local commit containing this receipt holds the page edits; its exact identity is supplied in the review handoff.

The reconciliation brought in PR #112's accepted API/migrations and PR #113's deployment gate. Four mechanical conflicts preserved the parked page imports, Sources table/prose, and canonical-example reader. The integrated candidate toggle fixture was retained alongside the canonical light switch. Beta.14's original runtime test was copied unchanged into `scripts/__tests__/fixtures/handbook/beta14-toggle.test.tsx` and its registry lane now reads that file, so it cannot accidentally execute the light-switch test against the historical toggle. Sources received only the accepted migration additions; no new Sources editorial pass occurred.

Runtime package source, public declarations' source, package manifests, root agreement and workflows match integrated beta. Shared site CSS/components and navigation match the parked checkpoint. The parked lockfile is retained unchanged: SHA-256 `8aa8b83320068170d821c4dc2d8f472a8f6e13b542bb18117739af835548fccf`. Frozen install uses Node 22.16.0 and pnpm 10.33.0.

## Page edits and coupled files

- `docs/site/src/examples/light-switch/src/light-switch.tsx`: changed `commands: ({ actor })` to `commands: ({ source })`, and `actor.send(...)` to `source.send(...)`. No other example behavior changed.
- `README.md` and `packages/ignite-element/README.md`: the same two substitutions in each copied snippet. These are the only three newly edited command callbacks. Their release notice/install text now matches the unreleased preview, and their matching-source links point to the candidate page rather than the old deployed page.
- `docs/site/src/content/docs/index.mdx`: preserves the short paragraphs, XState machine, inline states/commands, `core(...)`, JSX setup, HTML mounting, optional Vite and ownership link. Replaces the beta.14 install with a concise Starlight preview notice. Removes the premature standalone-download install steps. The example still reads `source → states → view`.
- `docs/site/src/examples/light-switch/package.json` and new `README.md`: the preview declares `workspace:*` rather than falsely installing published beta.14. The archive is explicitly source-only until release. Candidate validation substitutes exact local tarball dependencies in a disposable consumer; it does not alter public package versions.
- `docs/site/src/pages/examples/light-switch.zip.ts`: includes that preview README in the otherwise identical source ZIP.
- `docs/site/scripts/generate-agent-docs.mjs`: removes the obsolete Getting started beta.14 exception. The current export teaches source and labels its unreleased status; historical v2 stays separate.
- `docs/site/scripts/check-handbook.mjs`: checks the canonical source/README/export/ZIP agreement, the historical actor fixture, and the preview manifest boundary.
- `docs/site/scripts/check-primary-consumers.mjs`: retains strict web/native and registry beta.14 coverage, adds the exact candidate preview's TypeScript/Vite build, and records tarball hashes, installed package paths, ESM resolutions and lockfile identities.
- `docs/site/scripts/check-version-routing.mjs` and its test file: require the preview notice and reject public Ignite installation commands on this unreleased page. Existing published/historical selector tests remain active on compatibility guidance. New negative cases reject beta.14, a moving beta tag, or removal of the preview notice.
- This receipt and `ledger.md` record the narrow reopened review and release checklist. Prior receipts remain historical.

## Package evidence

These are locally packed candidates from the integrated runtime, not registry beta.14. Manifests still say `3.0.0-beta.14` because package version preparation is outside scope. Exact tarball SHA-256 identifies the tested bytes:

| Package | SHA-256 |
| --- | --- |
| `@ignite-element/core` | `002de98dac6aa41fa92838253bcab8a820e56ae76d98ab8c9cf6c7e65644864a` |
| `@ignite-element/adapters` | `a81e91cc1ed1ef51f70df6bc146174b5fb5ce7d9b035ebb7ffee13ece7e4b026` |
| `@ignite-element/renderer` | `4216915b592f26032c674c69f52bbca6ed60013731390e133f38a0e13a1ab493` |
| `ignite-element` | `f94f77ba2d72d552188b2e80d0975d1503d187b32274ed0ac8dcd0ccff5f0743` |

The consumer manifests use file tarballs for all four packages and pnpm overrides for transitive resolution. Web/preview package realpaths include the corresponding `file+..+tarballs` store directories. Native's hoisted installation resolves inside its isolated node_modules. All ESM entry resolutions point to installed dist files. There are no Vite source aliases. Full provenance remains local review evidence. Historical beta.14 uses a separate manifest with the exact registry version and no candidate overrides.

## Validation

- Public package build, export verification and strict package/source typechecks passed. Existing inference, invalid-input and removed-actor guards remain active.
- Packed verification passed ESM inventory, package provenance, strict declarations, optional peers and headless/DOM isolation.
- Strict handbook consumers passed: four web runtime tests, two native tests plus isolation, and the separately labeled beta.14 registry runtime test. The candidate preview passed strict TypeScript with `skipLibCheck: false` and Vite production build.
- Browser interaction passed in both the built docs and the isolated Vite project using candidate tarballs: Off/0 → On/1 → Off/2, including native pointer, Space/Enter, ARIA state, visible keyboard focus and the real shadow-root stylesheet. The packed web test retains independent sibling behavior.
- Documentation build: 68 routes, ZIP, current and historical agent exports. All five handbook route tests, 23 redirect mappings/fragments and 3,147 internal references passed. All 297 publication tests passed. Secondary snippets: 31 compiled, one known fragment, seven existing explicit historical/illustrative exclusions, no new exclusions. Astro: zero errors/warnings and one existing unused-variable hint.
- Existing visual suite passed 60 responsive page/theme cases, 66 WCAG-AA contrast checks and 12 native control geometry checks. Includes 390/768/1280/1440/1920 widths, both themes, pagination hover/focus, menu/guide navigation, disclosures, code copy, spacing and contained code scrolling. No shared presentation code changed.
- In-app review separately checked desktop/mobile DOM geometry, light/dark interaction, TSX clipboard equality (including indentation), seven direct documentation destinations and back navigation. The existing visual suite supplies complete desktop/mobile screenshots; some in-app stitched captures were distorted and are not review evidence.
- Architecture and formatting checks passed. Normal commit hooks enforce lint and commit-message checks. Existing broad runtime-suite evidence is reused for unchanged runtime source; no unrelated full suite was repeated for this page.

One new provenance check initially attempted an unexported package.json subpath. It was corrected to inspect the installed manifest by filesystem path and separately resolve the public ESM entry. No package export or validation assertion was weakened.

## Links and remaining findings

The stable-v2 destination retains its archive notice. The ownership link lands on terminal disposal and preserves the private/borrowed source distinction. Sources, Views, Examples, API reference and Compatibility reach their expected subjects. Compatibility explicitly describes published beta.14 rather than pretending to validate the new command syntax.

All A01–A12 and E01–E10 inventory rows remain in the ledger. Sources still needs its own review and installation/version reconciliation; Views/Examples and their React/native/other project destinations remain queued. Compatibility retains its historical release narration (A04/A09), and the v2 archive still requires the separately scoped historical review (A12). These routes resolving does not accept their content. External playground/provider checks and native-device/screen-reader verification are not claimed here. The known boolean-ARIA renderer observation remains outside this documentation slice; the supported explicit string serialization is unchanged.

## Release reconciliation checklist

1. Complete the page-by-page reviews before the separately authorized coordinated release.
2. Select the actual supporting beta through the existing release process. Do not infer it from today's manifest number or invent the next version.
3. After package publication and registry verification, add the exact install selector to Getting started and both READMEs. Replace the example manifest's `workspace:*` with that verified version and restore the standalone ZIP install instructions.
4. Update the temporary preview/manifest assertions in `check-version-routing.mjs`, `check-version-routing.test.mjs` and `check-handbook.mjs`; update preview README and agent-export release text. Keep historical beta.14 fixtures/registry checks and removed-actor guards.
5. Revalidate the source ZIP and full first-component path against the actual registry packages, then deploy only the accepted matching docs via the existing manual beta dispatch. Preserve event/ref concurrency isolation and verify package availability before dispatch.

## Preview and custody

Review URL: <http://127.0.0.1:4326/ignite-element/>. The isolated packed example is at <http://127.0.0.1:4330/>. Preview processes, their required installed dependencies/build output, tarballs, logs and screenshots are intentionally retained as local review artifacts. Failed task-local consumer output is removed; pre-existing parked outputs and other worktrees are preserved. No stash changes, remote push, PR creation, protected merge, version preparation, package staging/publication, dist-tag change or deployment occurred.

The focused build/checks took seconds, packed consumers required disposable cached installs, and the existing browser matrix took about a minute. The repetition followed the concrete provenance-check correction; required evidence was not rerun solely for a ref-name change. Stop here for Getting started review.
