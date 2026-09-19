# Getting started — shared-theme correction

Status: awaiting review. Date: 2026-09-16. Getting started is still unapproved; Sources remains queued.

## Scope and custody

The Operator authorized simplifying the shared presentation around Starlight before continuing the page sequence. This is a correction to the first slice under the existing local-only manifest. Starting commit: `c78e918b2312bb7861d1af119e95f350bb91da9c`; tree: `5b3a4cb2d9688d892586a06cce227273459c3cf6`. The candidate is the commit containing this receipt; the handoff supplies its exact commit/tree. Branch: `fas/docs-page-refinement`.

The starting worktree was clean. Runtime packages, dependencies, lockfiles, governing files, page prose, examples and archived v2 content are unchanged by this correction. Other worktrees and stashes are preserved. No push, PR, merge, deployment, package release or acceptance is performed.

## Correction and evidence

- `blocking_correctness`, corrected: the old gray overrides reversed the meaning of Starlight foreground tokens. Pagination hover in dark mode reduced border contrast from 1.58:1 to 1.05:1; the expanded mobile menu also used nearly black ink on a dark fill. A new rendered regression test failed against the original built candidate before the CSS changed.
- `styles/theme.css`: reduced from 716 to 156 lines. Starlight now owns neutral colors, text, surfaces, navigation states, asides, search, code and button presentation. Removed duplicate control/radius tokens, the decorative background and compensating sidebar/TOC/pagination rules. Kept supported green-beta/cyan-archive accents, the required header/TOC alignment, readable prose width, SVG sizing and keyboard-scrollable table layout.
- `components/ThemeSelect.astro`: the version picker uses the same Starlight `Select` component as the theme picker, retaining native keyboard behavior, version destinations and browser-Back handling.
- `components/Footer.astro`: support links inherit Starlight’s content-link class. `components/VersionNotice.astro`: the archive notice uses Starlight’s `Aside`, preserving its version text and destination while removing its unthemed link and custom panel styling.
- `scripts/check-contrast.mjs`: adds actual pagination hover/focus, footer default/hover parity, archive-notice link contrast and mobile open/close checks in both themes and versions. Retains all 11 control geometry checks, now checking native Starlight/Expressive Code dimensions and padding instead of requiring the deleted custom radius scale. Focus assertions check a visible native outline. Optional `DOCS_SCREENSHOT_DIR` retains rendered review evidence outside the repository.

The original static text/layout checks passed while missing the reported interaction defects. Those earlier results did not establish complete theme consistency. This correction covers those missing states without claiming exhaustive accessibility certification.

## Validation

Toolchain: Node 22.16.0; pnpm 10.33.0; Starlight 0.39.3. Lockfile unchanged. No new dependencies or package downloads for this correction.

| Check | Result |
| --- | --- |
| Focused browser regression | Failed on the original dark pagination hover; passes after correction for beta/archive in both themes. Dark hover 10.06:1, light hover 11.71:1; both strengthen the default border. |
| Responsive/browser matrix | 50 page/theme/viewport combinations at 1280, 1440, 1920, 768 and 390px; Getting started, Examples, API, Routing and archived API. Header/TOC alignment, native select height, no page overflow, table grids and keyboard table/code scrolling pass. |
| Contrast/geometry | 58 sampled contrast checks pass; all 11 native control geometry checks pass. Mobile close icons, pagination keyboard focus, footer link states, version round trips and four Events redirects also pass. |
| Site build/export | 67 pages; regenerated current/archive agent exports. Getting started’s current opening remains in the export. |
| Astro | Zero errors and warnings; one existing unused-variable hint. |
| Publication / handbook / links / built versions | 283 publication tests, five handbook tests, 2770 internal references, 67 HTML documents and built version contracts pass. |
| Secondary snippets | 31 complete TS/TSX blocks typechecked, one intentional fragment; no new drift. |
| Repository gates | Formatting, lint, architecture, 766 package tests, 148 script tests and 454 example tests pass. Normal pre-commit hook retained. |

Search was exercised manually with `toggle` in both themes: ten results, readable default Starlight text/surfaces, and Escape dismissal. Visual inspection includes current and archived pages, reference tables, desktop light/dark, mobile light/dark and the expanded mobile menu. No new page-content acceptance is implied.

Strict packed/native consumer evidence remains in the original receipt and was not rerun: this correction changes no package source, declarations, exports, dependencies or snippets. Published-package example behavior also remains prior evidence, not a newly executed claim.

## Toolchain and validation friction

The initial full-suite invocation passed all 766 package tests and 147/148 script tests, then stopped before examples. The real-npm fixture selected a Volta shell launcher that it attempted to execute as JavaScript. Selecting Node 22’s bundled npm exposed a second path-spelling mismatch between `/var` and `/private/var`; using a physical temporary root resolved that assertion. The complete script suite then exposed Volta’s pnpm launcher replacing the fixture’s synthetic npm on PATH. With the actual installed pnpm 10.33.0 and Node 22.16.0 binaries selected directly, plus a physical temporary directory, all 148 script tests passed. No test, runtime or release code was patched or skipped. The exact 10-project example command ran separately and passed all 454 tests.

The full script-suite command was `node --test scripts/__tests__/*.test.mjs scripts/release-beta.test.mjs`, with the installed pnpm and Node bin directories preceding launcher shims on PATH and a physical TMPDIR. All failed and passing command logs are retained as local evidence. These environment-sensitive results must not be represented as an uninterrupted green `pnpm test` invocation.

Automatic approval review rejected an initial proposal to remove radius-scale geometry checks. The safer correction retained geometry coverage against the native components; that version passed. Chromium required normal sandbox escalation. Existing Astro migration/plugin warnings and lint notices remain. The unused, unreferenced `CounterDemo.astro` is not rendered by any current route; its historical custom styling is outside this slice and is not evidence of a shipped theme defect.

## Review handoff

Preview: <http://127.0.0.1:4323/ignite-element/>. Restart with `pnpm --filter docs-site build` and `pnpm --filter docs-site preview --host 127.0.0.1 --port 4323` in the candidate worktree.

Desktop/mobile screenshots for both themes and representative routes are retained outside the repository and linked in the local handoff. Desktop in-app captures were clipped by the host pane, so the full-size review screenshots come from the same Chromium regression run that checked the specified viewports; mobile was also inspected in the in-app browser. Dependencies and generated build/search/export output already retained for this local preview remain task-owned and uncommitted.

A01/A08/A10 content changes remain as in the original candidate. This shared correction addresses A06–A09 presentation and the shared-footer part of A12. All remaining page/example findings remain queued in the [ledger](ledger.md). Full screen-reader and physical-device acceptance remain unverified. Review Getting started again; do not advance to Sources until the Operator accepts it.
