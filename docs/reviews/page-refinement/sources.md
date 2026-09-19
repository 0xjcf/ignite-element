# Sources — copy, source inputs and guide navigation

Status: awaiting review. Date: 2026-09-17. The Operator accepted Getting started at `7d8e37840bfacb2835bd2f99f2cab5b9e9558275` and authorized Sources with the same short sentences, single-idea paragraphs and scannable headings, plus discoverable guide navigation.

Starting commit: `7d8e37840bfacb2835bd2f99f2cab5b9e9558275`; tree: `3998a6b9a2338b416caf4e2b6336294ccbedf54e`. Clean starting worktree on `fas/docs-page-refinement`. The local commit containing this receipt is the review candidate; exact identity is supplied in the handoff. Views remains queued.

## Corrections and scope

- A01: replaced the vague native-snapshot table with adapter-specific inputs to states. Verified XState actor snapshots, Redux getState/slice selection, MobX toJS and Actor-Web extended-state construction against the current adapter implementations. Methods and computed getters are not promised as MobX snapshot fields.
- A01/A08: corrected the Getting started reference to a machine definition with an independent actor per element. Separated source behavior, derived state, commands and application I/O. Preserved borrowed-source shutdown and terminal core disposal ownership.
- A08: use short, single-sentence paragraphs and clear source-library headings. Split imports and callback inputs into two focused tables. At 390px the shortened labels allow full import paths to remain on one line without adding CSS overrides.
- A10: supply consistently labelled Terminal install blocks and complete filename-labelled Redux/MobX modules imported from their existing checked fixtures. The examples keep inferred states and commands inline. Source modules are unchanged; XState points to the accepted runnable light switch instead of duplicating it.
- Operator navigation request/A11: added a native, collapsible Guides group after the eight primary handbook entries. It includes all six retained guide pages, excluding redirect-only routes. Starlight expands the group around an active guide and highlights its link. The archived version retains its own navigation.

Only Sources content, site sidebar configuration, browser checks and this review ledger/receipt changed. No CSS override, runtime, public API, example implementation, dependency, lockfile, frozen v2 source or governing-file change.

## Direct destinations and remaining findings

The Getting started anchor resolves to the accepted light switch. Views and Ownership & cleanup resolve to the promised rendering and lifetime subjects; their broader editorial reviews remain queued.

Actor-Web and Plain controllers are existing retained guide destinations, not missing or renamed handbook pages. Both now have return paths in the sidebar. Their substantial content reviews remain separate, as required by the one-page cadence:

- Actor-Web: A01/A03/A05 remain queued. The retained guide still contains the read-only send no-op claim contradicted by the adapter's error path, and home.dispose is not in guaranteed cleanup. These existing correctness findings are not silently accepted by adding navigation.
- Plain controllers: A05/A10/A11 and example E03 remain queued, including obsolete shared-controller restrictions and preparation/lifetime explanation. No broad guide or example rewrite was included in this Sources slice.
- Shared sources, Routing, Accessibility and Build for agents retain their ledger findings and review order. Navigation reachability is not content acceptance.

## Validation

- Before navigation changes, the built sidebar contained zero Guides groups and zero Actor-Web links, while Sources linked to that guide. This is the bounded contradiction evidence.
- Documentation build passed: 67 pages, ZIP, current/archive agent exports and search index.
- Handbook: five route tests, 23 legacy mappings, version directions, fragments and canonical download/export comparisons pass. All 3098 internal references resolve across 67 built documents.
- Publication checks: 283 tests and publication contract pass. Secondary snippet checks: 31 complete blocks pass, one intentional fragment. Astro: zero errors/warnings, one existing hint.
- The unchanged Redux and MobX fixture bytes match the previously validated strict packed consumer. Reran that consumer's TypeScript check with skipLibCheck false successfully; package sources and lockfile remain unchanged.
- Fresh isolated Redux and MobX projects used the documented install commands with published ignite-element 3.0.0-beta.14. Each actual displayed module compiled with TypeScript 5.9.3, strict true and skipLibCheck false. Each ran headlessly, verified count 0, executed increment, verified count 1, and disposed the core in finally. Redux Toolkit resolved to 2.12.0 and MobX to 7.0.3. This is narrow evidence for these modules, not a general new compatibility guarantee. Fresh projects used Node 22.16.0 and pnpm 10.15.1; repository checks used pinned pnpm 10.33.0.
- Browser checks: 60 page/theme/viewport cases across 1280/1440/1920/768/390px, 64 contrast checks and 14 existing native controls pass. Sources participates in table-grid, code-scroll and document-overflow checks. New behavior checks follow both Sources guide links, verify the active sidebar entry, return to Sources, expand Guides with the keyboard and revisit the guide on desktop/mobile in both themes.
- Reviewed Sources light desktop/dark mobile screenshots and active guide navigation. Reloaded the in-app Sources preview; document overflow is zero. Real-device and screen-reader acceptance were not performed.
- Formatting, architecture, whitespace and normal commit-hook checks pass. No unrelated full runtime suite was repeated for this editorial/navigation slice.

## Custody and cost

Lockfile SHA-256 remains `8aa8b83320068170d821c4dc2d8f472a8f6e13b542bb18117739af835548fccf`. Existing generated output and dependency directories were preserved. New sandbox projects, browser screenshots and logs remain task-local evidence outside the repository. Fresh installs reused cached packages except one MobX download. No dependency install changed the task worktree.

A first new navigation check failed because its exact regex omitted whitespace in Starlight's rendered summary label. Inspecting the native DOM identified the test-selector issue; matching the same label with surrounding whitespace fixed it without changing or weakening the navigation behavior being asserted. The final matrix passed. Chromium and Git use the ordinary authorized execution escalation.

No push, PR, merge, deployment, package publication or release. Preview: <http://127.0.0.1:4323/ignite-element/handbook/sources/>. Await Operator review before beginning Views.
