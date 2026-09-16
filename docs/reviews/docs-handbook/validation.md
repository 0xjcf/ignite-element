# Handbook review receipt

## Authority and custody

Authorized endpoint: documentation/example candidate and review PRs, before Navigator review, merge, deployment, or publication. The Operator confirmed the effects paragraph in beta `AGENTS.md` at `d77118fbb660ccaa2c850ce42b44ecd9c2779645`; it supersedes only the outdated conversation paragraph. No runtime or governing file changes.

- Repository: `0xjcf/ignite-element`.
- Authenticated beta base: `d77118fbb660ccaa2c850ce42b44ecd9c2779645`; tree `323a6a5c352b7863eca955db181717d7ed877248`.
- Candidate branch: `fas/docs-handbook-refinement`, isolated from the primary checkout.
- Primary checkout preserved at `e2eb1517c8818a16a3142ff2c2b6c534674625d4`, branch `task/v3-pnpm-pack-config-correction`, tree `4696a7c13c536d56d78cd754b60feb7bed2fa293`.
- Stable README-only PR: [#110](https://github.com/0xjcf/ignite-element/pull/110), base `90b73dad980a9608eef82d957d2c2f967ee494b4`, candidate `240cbd357549c6f852a02efc069ad30c2bc71b77`, tree `92deb00e3084c90d2201324705cf1944b51e561d`.
- Task-local dependencies, packed consumers, preview output, caches and logs are retained for review under the approved manifest. None is committed. Existing worktrees, stashes, source packages, package exports, release versions and inactive `.fas` evidence remain untouched.
- Standard Husky-generated wrappers were initialized locally using the installed Husky implementation; the existing shared `core.hooksPath` value was preserved. Commit and push hooks remain enabled.

The PR head supplies the exact final candidate commit/tree; this receipt deliberately avoids a self-referential commit identifier.

## Information architecture and coverage

Getting started → Sources → Views → Events & effects → Ownership & cleanup → Testing → API reference → Examples.

Migration is a separate collapsed group. Focused recipes preserve Actor-Web, routing, agent tools, plain controllers, shared-source sessions and accessibility. Supporting reference retains headless return/error details, commands/tool schemas, optional configuration, compatibility and historical measurements. Support links are in the footer. The voice-workbench entry README links its preserved architecture/validation manual.

[Dispositions](dispositions.md) covers all 59 audit rows (50 existing routes plus nine missing destinations) and all 121 source documents. The executable [route map](../../site/src/route-map.json) records 23 legacy mappings and useful fragment destinations. Static destination links and client navigation work without server redirect support; old archive API prose remains frozen.

## Audit resolutions

These identifiers follow the supplied audit's D01–D10 labels.

| Finding | Result and evidence |
| --- | --- |
| D01 Release identity | Root/package READMEs and current references distinguish published beta.14 from stable 2.2.2. Stable README links corrected separately in #110. Publication policy tests pass. |
| D02 Readiness, disposal, timing | [Ownership](../../site/src/content/docs/handbook/ownership.mdx) and [events](../../site/src/content/docs/handbook/events.mdx) teach ready shared cores, terminal registered disposal, borrowed-source ownership, one activated evaluator, zero-view persistence, queued delivery without a commit guarantee, synchronous void and existing errors. Native declarations, multiplicity and conflict rules are preserved. Current testing/reference contradictions are corrected. |
| D03 Migration contract | [Migration](../../site/src/content/docs/migration/effects-events.mdx) explicitly labels historical command emission; its complete current source occurrence retains both mode input and toggle transitions. The current module compiles against packed exports. |
| D04 React entry | [App](../../../examples/frameworks/react/src/App.tsx) promotes two source-derived hook views; increment/decrement and label updates synchronize. Real-element refs remain in the expandable web interoperability recipe. Strict web/native consumers and browser interactions pass. |
| D05 Navigation and runs | [Theme selector](../../site/src/components/ThemeSelect.astro), archive notices and route mappings resolve counterparts or selected-version home. Both desktop/mobile selector instances are bound. Framework/form run paths and source links are corrected. Built checks cover every version destination and legacy fragment. |
| D06 Beginner scope | Eight short primary pages replace redundant onboarding; optional features remain linked recipes. Current contracts have authoritative handbook destinations. Voice-workbench operational detail is preserved in a companion document. |
| D07 Adapter ownership | [Sources](../../site/src/content/docs/handbook/sources.mdx) distinguishes source normalization from application I/O ports. Existing actors/stores/observables are used directly; ordinary states/commands stay inline. |
| D08 Copyability | Canonical TSX files, separate source/core/view tests, formatter output, wrapped CLI/imports and accessibility `ctx` replace malformed/dense blocks. Clipboard reads for toggle and React modules contain code only, with newlines and indentation. Mobile code remains independently scrollable. |
| D09 Navigation priority | Events, ownership and testing are primary pages. Accessibility remains linked supporting guidance. Retired testing is under Migration. Sidebar labels match destinations; all legacy URLs have useful destinations. |
| D10 Accuracy gates/agent exports | [Packed consumer runner](../../site/scripts/check-primary-consumers.mjs) uses strict types and `skipLibCheck: false`, separate native/web installations, public packed imports, no placeholders. README quickstart equality and run directories are checked. Agent entry index is 50 words; current and v2 full exports are separate and canonical imports survive export. Historical bundle measurements and the NodeNext declaration limitation remain explicit. |

## Before and after

- React entry: mirrored element count plus imperative ref → `const ctx = useIgnite(core)`, `ctx.count`, `ctx.increment()` and `ctx.decrement()`. The original element integration remains a labeled advanced recipe.
- Ordinary construction: scattered callback files/preparation reads → inline `states` and `commands` using inferred source-native snapshots. Isolated runtime acquisition remains explicit.
- Accessibility renderer: a long destructured parameter and dense attributes → `ctx` and formatter-driven JSX. Testing now has separately titled real source, core and rendered-control modules.
- Version switching: shared-controller validation → missing `/2.x/contributing/...` 404 on the live site → archive home in the built candidate, with a return to current home.

## Validation

Environment: Node 22.16.0, pnpm 10.33.0 for beta. Stable main uses its own pnpm 10.15.1. Both installations use frozen locks. Beta workspace lock SHA-256: `af89205aefb83cebc12e1c31cceeaef878b9251c27a71fe994a35942248f7455`. Packed web fixture: React 19.1.0, TypeScript 5.9.3; native fixture: React Native 0.81.5 and its real test host, with no DOM library. This is not device, Expo or Metro acceptance.

| Command | Result |
| --- | --- |
| `pnpm --filter @ignite-element/core --filter @ignite-element/adapters --filter @ignite-element/renderer --filter ignite-element run build` | Package JS/declaration builds pass. |
| `pnpm run format:check` | Biome and Markdown formatting pass. |
| `pnpm run lint` | Pass; non-fatal existing/template-analysis warnings remain. |
| `pnpm run architecture:check` | Pass. |
| `pnpm --filter docs-site check:publication` | 283 tests pass; zero workflow or stable-install policy violations. |
| `pnpm --filter docs-site check:docs` | 31 fenced modules checked, one fragment; zero baselined failures. Seven explicitly excluded historical/specialist fragments remain honestly classified. This legacy checker alone is not strict consumer proof. |
| `pnpm --filter docs-site check:astro` | Zero errors/warnings; one existing unused-variable hint in the checker. |
| `pnpm --filter docs-site build` | 67 HTML routes; Starlight component override notices are intentional. |
| `pnpm --filter docs-site check:versions:built` | Required route/disclosure/install policy passes; full counterpart coverage is in the handbook check. |
| `pnpm --filter docs-site check:links` | All built internal links, anchors and assets resolve. External URLs are not exhaustively health-checked. |
| `pnpm --filter docs-site check:handbook` | Four focused tests plus all 67 routes, 23 redirects, fragment destinations, both version choices, agent exports and README checks pass. |
| `pnpm --filter docs-site check:primary` | Strict packed XState/Redux/MobX/JSX/React/native/event/migration modules pass; four web tests and two native tests pass; native optional-peer isolation passes. |
| `pnpm --dir examples/frameworks/react run build` | Production build passes. |
| `pnpm --filter docs-site check:contrast` | 52 contrast checks, 10 control geometry checks; desktop/mobile version round trips pass. |
| Complete hook profile (`test:packages`, `test:scripts`, covered `test:examples`) | 68 package files / 766 tests, 148 script tests and 454 tests across all ten discovered example packages pass. Normal pre-push repeats this profile. |
| Stable normal hooks | Lint and 24 files / 259 tests pass. |

Focused contradiction evidence preceded edits. Browser testing found a mobile-only selector issue (Starlight renders two controls); binding both instances fixed it, and the regression now exercises both widths. Broader tests also identified assertions pointing at merged pages and misplaced standalone test fixtures; they were corrected without weakening discovery or API assertions. The substantive Redux checker fixture is retained independently of page layout.

The release-verifier test invokes npm's resolved file with Node and compares temporary paths literally. Volta's executable/shell shims and macOS `/var` symlink paths fail those assumptions. The unchanged focused test passes with Node's bundled npm and the actual pnpm launcher on PATH (avoiding Volta shim injection), plus a canonical task-local TMPDIR. This environment is also used for the normal complete hook suite; no test suppression or release implementation change was made.

## Browser evidence and limits

[Route/viewport observations](browser-coverage.json) contain the actual browser DOM measurements. Every one of the 67 resulting paths was opened at 1366px, including all legacy paths, 17 original archive pages, the archive fallback and the 404 page. All rendered destinations had headings and no whole-page horizontal overflow. An early archive image observation preceded loading; all five archive images subsequently loaded successfully.

The eight primary pages plus headless reference, accessibility, archive home and archived core reference were checked at 390px and 768px in light/dark themes (48 observations), and at desktop in both themes. Tables stay within the page; intentional code scrolling remains available. Browser snapshots/screenshots, actual copied toggle/React code, mobile menu, keyboard skip link, search results, mapped legacy anchor, archive/current switching and React count/label/interop behavior were inspected. Search for `useIgnite` returned current Views/React/React Native destinations and no duplicate redirect pages.

A browser viewport override initially affected another tab; only measurements confirming the actual requested width are recorded as responsive evidence. Native tests are host tests, not physical-device validation. Keyboard skip/navigation and focusability were checked; a full assistive-technology audit is outside this round.

This is local built-preview evidence, not production verification. No new bundle-size measurement is claimed. Known NodeNext limitations remain documented. Navigator review and Operator integration/deployment remain open.

## Public-site checks after separately authorized deployment

1. Verify the deployed commit and the eight primary pages; recheck desktop, tablet and mobile in both themes.
2. Replay every old-route/fragment mapping from the route map on GitHub Pages.
3. Switch versions from every route; confirm selected-version home fallback and archive return links.
4. Check search, code copying, mobile menu, keyboard focus, tables, scrolling and assets under `/ignite-element/`.
5. Fetch the short/current/archive agent exports; confirm version isolation and intact code imports.
6. Confirm stable README links reach v2 and beta links reach the new handbook. Record production evidence separately.

## Workflow cost

Task-local workspace, React and isolated packed-consumer installs were necessary to verify public imports and platform isolation. Packed checks were repeated when canonical content, strict library requirements or fixture locations changed. Browser/build repetitions followed observed routing, export, formatting and mobile-control defects. Full package/script/example runs are required by the normal pre-push hook, beyond the focused docs profile. No review archive or full-history bundle was created. Generated output is retained only in task-local installations/temporary directories under the manifest. One earlier authority clarification established the accepted effects paragraph; no additional product approval was requested.
