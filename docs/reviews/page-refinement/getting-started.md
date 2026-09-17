# Getting started — local review candidate

Status: awaiting review. Date: 2026-09-16. Next proposed page: Sources, only after Operator acceptance.

## Authority and custody

The page-by-page refinement prompt authorizes this local Getting started slice and shared presentation corrections, validation, a task branch and normal commits. No push, PR, integration or deployment is part of this candidate.

Start: `cd40ce117cf5a2a3be92415ba7e02bd99e45d969`, tree `632410b8b74284cd8588fbaca58d001c96d13014`, authenticated against remote beta; unchanged from both audits. Branch: `fas/docs-page-refinement`, in an isolated worktree. The candidate is the commit containing this receipt; its exact commit/tree is returned in the handoff. The primary worktree and all prior review artifacts were preserved. No stashes or existing branches were changed.

The current beta agreement retains the explicitly accepted core/source effects paragraph. Runtime source, public APIs, root agreement, root lockfile, canonical toggle, READMEs and all 17 archived v2 content pages are byte-identical to the baseline. No effects semantics changed.

## Changes and dependencies

- A01, A08, A10: `docs/site/src/content/docs/index.mdx` leads with source → states → view, installs published beta.14 in an empty directory, labels each file, formats HTML, and moves project-wide JSX options to an optional JSON block. Inline inferred states/commands, ctx and the existing terminal cleanup remain intact.
- A06, A07: `components/Header.astro`, `components/ThemeSelect.astro` and `styles/theme.css` share the header/right-rail width. Native selectors share caret, geometry, colors and focus treatment. The Starlight primitives and route destinations are preserved.
- A08, A09: 72ch prose with wider code/tables; short inline code stays together, long paths can wrap. `src/rehype-scrollable-tables.mjs` adds named keyboard-scrollable table regions at build time. The actual table grid fills its frame. This presentation applies to current and archived pages without editing their content.
- A11 navigation: `astro.config.mjs` exposes exactly eight beta handbook entries. Migration destinations remain linked and searchable; frozen v2 navigation retains its own structure.
- Documentation checks: `scripts/check-contrast.mjs` now checks responsive geometry, local table/code keyboard scrolling, selector keyboard focus and version history. `scripts/check-version-routing.test.mjs` updates fixture mutations to the pinned installation command and shortened stable sentence without weakening rejection tests.
- Agent exports regenerated through the existing generator; the revised opening and complete canonical module are present. Other page findings remain queued in these exports. Root/facade README copies of the unchanged toggle still match.

Component/style/check paths above are relative to `docs/site/`. The [ledger](ledger.md) covers all 43 audited pages, 23 redirects, 404, 13 linked example projects, native fixtures, READMEs, supporting sources and current/historical agent exports. No content outside Getting started was rewritten.

## Validation

Repository toolchain: Node 22.16.0, pnpm 10.33.0. Lockfile blob: `ec7ece808a4270a0d490b269f50116e6c09a0ce3`. Frozen offline workspace installation reused cached dependencies; no lockfile changes.

| Check | Result |
| --- | --- |
| `pnpm format:check`, `pnpm lint`, `pnpm architecture:check` | Pass; pre-existing informational lint notices remain. Normal pre-commit lint also runs. |
| `pnpm --filter ignite-element... build` | Pass; declarations and export verification included. |
| `pnpm --filter docs-site check:primary` | Pass; strict packed web/native consumers, actual MobX README and runtime checks. |
| `pnpm --filter docs-site check:docs` | Pass; 31 checked blocks, one fragment, seven existing exclusions. This permissive secondary check does not certify queued supporting examples. |
| `pnpm --filter docs-site check:astro` | Zero errors/warnings; one existing unused-variable hint. |
| `pnpm --filter docs-site build` | 67 pages; regenerated separate current and v2 agent exports. |
| `pnpm --filter docs-site check:publication` | 283 tests pass; publication contract unchanged. |
| `pnpm --filter docs-site check:handbook` | Five tests; 67 routes, 23 mappings, both version directions, mapped fragments and README equality pass. |
| `pnpm --filter docs-site check:links` | 2770 internal references across 67 built HTML documents resolve. |
| `pnpm --filter docs-site check:versions:built` | Pass; current and archive contracts preserved. |
| `pnpm --filter docs-site check:contrast` | 50 page/theme/viewport cases, 50 AA contrast checks, 11 geometry checks, table/code keyboard scrolling, browser Back and native selector interactions pass. |
| `pnpm test` | 766 package, 148 script and 454 example tests pass across all ten required example projects. |

The shared browser matrix covers Getting started, Examples, API, Routing (long code) and archived v2 API at 1280, 1440, 1920, 768 and 390px in light/dark. No document overflow; header divider and rail differ by at most one pixel. At 1440px, the visible browser measured both at 1105px, prose at about 726px, and both selects at 38px inside 40px frames. Examples table frame/grid both measured 815px; the former blank strip is gone. Wide tables/code scroll locally with arrow keys. Copying TSX preserves the canonical module with tabs expanded to two spaces; copied HTML matches the labeled file.

Focused-red evidence: the new browser assertion failed on the unchanged built baseline at 1280px: divider 940px versus rail 1068.46875px. The live 1440px baseline also showed native `auto` versus custom `none` select appearances and approximately 884px prose. The corrected build passes these checks. An initially premature code-focus assertion was corrected to await Expressive Code’s existing resize/idle initialization, then exercise real keyboard scrolling. Installation-fixture failures were corrected by updating their edit targets; release-policy assertions remain intact.

Separately, the exact installation commands were run in an empty consumer directory with registry packages: ignite-element 3.0.0-beta.14, XState 5.33.2, Vite 8.3.0, TypeScript 7.0.2, pnpm 10.15.1, Node 22.16.0. Vite builds passed both with only the pragma and with the optional JSON config replacing the pragma. Strict `tsc --noEmit --skipLibCheck false` passed. The browser button changed Off → On → Off. This is published-package evidence, independent of local source aliases.

## Preview and evidence

Local preview: <http://127.0.0.1:4323/ignite-element/>. Restart from the candidate worktree with `pnpm --filter docs-site preview --host 127.0.0.1 --port 4323` after `pnpm --filter docs-site build`. It is local-only and has not been deployed. The published-package toggle also remains available locally at <http://127.0.0.1:4324/> for review. The handoff links desktop/mobile screenshots and this receipt. Task-local screenshots include Getting started light at all five widths, dark desktop/mobile, Examples/API desktop, API mobile and v2 desktop. Exact screenshot paths are supplied only in the local handoff.

The direct destinations Sources, Views, Examples, API, Compatibility and v2 home were followed and their subjects/version labels inspected. They remain queued for content corrections: Sources A01; Views A08/A11 and E01/E02; Examples A11 and E03–E10; Compatibility A04; v2 A12. Supporting metadata, Actor-Web and migration correctness findings A02–A05 remain explicit in the ledger. External example playgrounds and a complete screen-reader audit are unverified; no claim of whole-site content acceptance is made.

## Friction and retained output

One isolated workspace install (offline); one published-consumer bootstrap with eight downloaded development packages and one downloaded runtime package; the packed-consumer gate manages its own isolated installs. The full repository gate ran once (package runner 3.52s, scripts 13.20s; examples completed by 20:13:04 UTC). Documentation builds took roughly four seconds; publication checks about 2.4s. Browser reruns were driven by concrete layout, fixture or interaction changes. Chromium required ordinary sandbox escalation; no user approval interruption or bypass occurred.

Task-local dependencies, package builds, docs build/search/agent outputs and screenshots are retained for the requested local preview and next review. They are ignored or outside the worktree, not committed. Packed-consumer/test outputs are identified as task-generated; transient outputs not needed for review are removed. Existing ignored output in other worktrees is untouched. No release tags, credentials, npm settings or workflows were changed.
