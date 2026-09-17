# Shared editorial consistency pass

## Authorization and scope

The Operator requested removal of unnecessary adapter-property explanations and
consistent short sentences, one idea per paragraph, and scannable headings across
all pages before continuing individual page reviews.

This explicitly broadens the earlier single-page editing scope for this editorial
pass. It does not accept later pages or authorize integration, release or deployment.

- Branch: `fas/docs-getting-started-source`.
- Starting commit: `b3d815649c9205eac018bf68aecf7c26a3055c12`.
- Starting tree: `9255948103b1c1c827e8135d4005c947d6ec6aad`.
- Starting worktree: clean.

## Changes

Applied the prose pass to 20 current-site pages: Getting started, all seven other
handbook pages, the four retained API references, four retained guides, current
migration guidance, the historical measurements page and the 404 page.

The short support list and redirect pages already use concise text. Frozen v2
pages and the historical v1-to-v2 guide remain unchanged. Historical measurements
retain their historical label and values.

Removed the adapter-property explanation from Sources, the API introduction and
the directly linked Redux README. Examples now show the supported import and
factory without introducing an unused configuration option.

Separated dense prose into short paragraphs. Added subheadings for factory
lifetimes, effect activation/timing/errors, native event delivery, shutdown,
execution results, and declaration compatibility. Replaced review-oriented
phrasing with reader instructions where it added no useful decision context.

Preserved existing section destinations. The renamed shared-source ownership
heading retains its old ID. Corrected the Testing page's prose link label from
`toggle.tsx` to the actual `light-switch.tsx` file.

Every fenced code block, canonical example import and rendered `Code` reference
is byte-identical to the starting candidate. Runtime sources, dependency manifests,
lockfile, workflows, theme styles and archive pages are unchanged. The effects
section retains the accepted evaluator, activation, lifetime, delivery, synchronous
return, error, ownership and disposal rules.

## Validation

- Documentation snippets: 25 typechecked blocks, one incomplete fragment skipped,
  seven explicit exclusions; no new drift. No code or validation exclusions changed.
- Publication/version policy: 299 tests passed; manual deployment gate unchanged.
- Astro: zero errors, zero warnings, one existing hint.
- Build: 68 pages and separate current/historical agent exports generated.
- Links: 3,012 internal references passed.
- Handbook: seven tests, 29 legacy mappings, mapped fragments and version directions
  passed. Downloadable ZIP and agent export still match the canonical light switch.
- Responsive/interaction suite: 60 layout cases, 64 contrast checks and 13 native
  control geometry checks passed. Desktop/mobile light and dark screenshots were
  inspected. Sources prose and Events heading structure were checked in the preview.
- Formatting, whitespace and normal commit-hook lint passed. Existing non-fatal lint
  diagnostics remain outside this editorial change.

Packed consumer evidence from the [preceding reconciliation](getting-started-factory-reconciliation.md)
remains applicable: package inputs, declarations, dependency graph, toolchain,
example files and code fences are unchanged. No new consumer install or runtime
suite was needed for prose-only edits. A final build and link/handbook check followed
the last short wording adjustments.

## Preview and custody

Preview: <http://127.0.0.1:4326/ignite-element/>.

Pre-existing dependencies and generated site output remain available for review.
The site build refreshed the existing output; browser screenshots and validation
logs are retained as task-local evidence outside the repository. The original
parked branch remains at `1cfc2310557e9ed602c6e7f9524e9827e45f4dbc`.

No remote push, release preparation, publication or deployment occurred. The beta
installation text is final publication copy; registry verification of the supporting
release remains a separate prerequisite before deployment.

The browser suite ran once with the established execution permission needed for
Chromium. A trailing blank line failed the first formatting check and was removed.
No checks were weakened. Builds took seconds and browser validation under two
minutes; no dependencies were installed for this pass.

## Page checkpoints

Getting started awaits re-review. Sources awaits review. Views remains queued.
All remaining pages retain their existing review status. Shared editorial
consistency does not confer individual content acceptance.
