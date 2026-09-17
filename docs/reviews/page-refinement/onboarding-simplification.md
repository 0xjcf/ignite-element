# Getting started — optional tooling and concise example

Status: awaiting review. Date: 2026-09-16. Getting started remains unapproved; Sources remains queued. The Operator approved the direction of both themes and asked to remove unnecessary onboarding material and ambiguity.

Starting commit: `6d425ce6a3b1c23e441182375b2eb29c3f8bacf1`; tree: `854c6f71449e38c57930ba830ff3bc7ba1b2025c`. The candidate is the local commit containing this receipt; the handoff supplies its exact identity. Same branch, `fas/docs-page-refinement`, with a clean starting worktree. No publication or deployment.

## Changes

- A08/A10: the primary install command contains only Ignite and XState. Vite is explicitly optional tooling for a new TypeScript/JSX web project. Collapsible setup and standalone HTML/run sections retain the complete empty-directory path. Existing projects use their own entry module and tooling.
- The canonical toggle module no longer exports an unused disposal helper. The page states that this demonstration keeps its core/source for the page lifetime and links directly to terminal-disposal guidance. Ownership semantics are unchanged.
- The fixture exports its source alongside the existing core so an actual owner can perform shutdown. The runtime test owns its teardown directly: remove the view, dispose the core, and stop its borrowed actor in finally. No cleanup is added to React view unmount.
- Root and facade README copies of the same canonical module are synchronized narrowly; their project prerequisite now says TypeScript/JSX web support rather than Vite. Their broader content remains queued.
- A browser assertion copies the displayed TSX and compares the clipboard bytes to the strict fixture, accounting only for the renderer's tab-to-space formatting. Agent exports are regenerated. No theme, renderer, runtime, API, dependency, lockfile, governing-file or archived-content changes.

## Validation

- Strict packed web/native consumers pass, including the revised toggle runtime test, strict TypeScript, MobX README, native isolation and two native binding tests. Existing built package artifacts are reused because package source/declarations/exports are unchanged.
- The revised module builds and passes strict TypeScript against installed published `ignite-element@3.0.0-beta.14` in the retained standalone consumer. Its browser control completes Off → On → Off. This run reused the previously installed dependencies and optional tsconfig; no fresh-project install is claimed.
- Site build produces 67 pages and regenerates current/archive agent documents. Export inspection confirms the optional-tooling text and shortened canonical example.
- Publication: 283 tests and contract pass. Handbook: five tests, README equality, 67 routes and 23 legacy mappings pass. Links: 2772 internal references resolve, including the terminal-disposal anchor. Astro: zero errors/warnings, one existing hint. Secondary snippets: 31 complete blocks pass with one intentional fragment.
- Browser: 50 page/theme/viewport cases, 58 contrast samples, 12 control geometry checks, preserved interaction/navigation checks, and exact TSX clipboard comparison pass in both themes. The extra copy control belongs to the separately presented install command. Optional setup and standalone-run disclosures were opened manually. Desktop/mobile screenshots are retained outside the repository.
- Formatting, architecture and normal commit-hook lint pass. Complete unrelated runtime/example suites were not repeated for this editorial correction; their unchanged-input results remain in the preceding receipt. The changed runnable example was checked directly through strict packed and published consumers.

The in-app clipboard reader returned an empty string after the copy click, so it was not counted as a successful copy check. The isolated Chromium regression runner exercised the real copy button/clipboard and verified exact bytes successfully. Browser tests required normal sandbox escalation; cached packed-consumer installs and generated outputs remain local evidence. No new custom design styling was introduced.

## Review

Preview: <http://127.0.0.1:4323/ignite-element/>. Published-package demonstration: <http://127.0.0.1:4324/>. The prior theme remains unchanged and the page is ready for another review. Full screen-reader/device validation and the remaining page/example findings remain as recorded in the [ledger](ledger.md). Do not advance to Sources without Operator acceptance.
