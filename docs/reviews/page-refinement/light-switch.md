# Getting started — live Ignite light switch

Status: awaiting review. Date: 2026-09-16. The Operator authorized porting the referenced light-switch example to Ignite, deriving the label in states, embedding the real example, and validating the instructions. Getting started remains the current page; Sources remains queued.

Starting commit: `d85ec85e0404dc7ca4a0e2e8704f304bc97de0a7`; tree: `472dc643c5ab9ad3cd008819ea06cf4178505a0a`. Clean starting worktree on `fas/docs-page-refinement`. The candidate is the local commit containing this receipt; the handoff supplies its exact identity. No push, PR, merge, deployment or release.

## Changes and ownership

- A10: ported the [light-switch reference](https://codesandbox.io/p/devbox/light-switch-mx6jcy) from Solid/XState to Ignite JSX/XState. The source owns off/on and increments its count on every FLIP. Inline states derives isOn, label and count; commands exposes toggle; the view uses ctx. Each element receives an independent private actor from the machine.
- Canonical source, CSS, HTML and standalone manifest live under `docs/site/src/examples/light-switch/`. The checked fixture moved there so Astro, the displayed code, generated export, ZIP and strict packed tests all consume the same implementation. The old toggle fixture was removed. The fixture test still owns terminal core disposal after removing its two elements.
- The bulb is decorative SVG. A native button exposes switch semantics, an explicit ARIA checked string, keyboard activation and visible focus. The count and label reflect source state. CSS is a separate file loaded inside the shadow root; the demo frame uses Starlight background/text/border tokens. Existing shell/theme styling is unchanged.
- Root/facade README code and their directly adjacent file/setup guidance match the canonical source. Broader README and supporting-page reviews remain queued.
- A static ZIP endpoint packages exactly the four canonical project files with fixed archive timestamps. Its public package versions are pinned. The agent export includes complete TSX/CSS/HTML and replaces the interactive component marker with a live-example link.
- The docs package now declares its workspace Ignite dependency, and the docs TypeScript configuration selects the automatic Ignite JSX transform. Build-only fflate 0.8.2 generates the downloadable ZIP. Root lockfile changes are limited to those docs dependencies. No library source, public API, release workflow, governing-file or archived-source edits.

## Validation and limits

Repository toolchain: Node 22.16.0, pnpm 10.33.0. Root lockfile SHA-256: `8aa8b83320068170d821c4dc2d8f472a8f6e13b542bb18117739af835548fccf`. Unchanged built library declarations/exports were reused for packed checks; new docs build and dependency inputs were validated explicitly.

- The packed runtime test checks initial Off/0, On/1, Off/2, ARIA checked values, and independent sibling state/count. Four web tests, two native tests, strict public TypeScript consumers, the actual MobX README and native dependency isolation pass.
- Fresh empty project: ran the current documented pnpm init, development dependency install and pinned Ignite/XState install; copied the exact TSX, CSS and HTML; ran pnpm exec vite. Browser clicks and Space produce Off/0 → On/1 → Off/2. Vite production build and strict TypeScript with skipLibCheck false pass without a tsconfig. Node 22.16.0, pnpm 10.15.1, Vite 8.3.0, TypeScript 7.0.2, XState 5.33.2 and published Ignite beta.14 were used. Package-manager cache reuse is not a clean-cache test.
- Downloaded artifact: extracted the generated ZIP into another empty directory, ran pnpm install and pnpm dev, and verified click/Enter transitions and counts in the browser. pnpm build passes. The handbook check compares every extracted file byte-for-byte with the canonical source and checks the TSX/CSS agent export, preventing download/source drift.
- Docs build: 67 pages plus ZIP and agent exports. Publication: 283 tests and contract pass. Handbook: five route tests, matching README snippets, mapped fragments and archive/source equality pass. Secondary snippets: 31 complete blocks pass, one intentional fragment. Internal links pass, including the ZIP. Astro: zero errors/warnings and one existing unused-variable hint.
- Browser: pointer, Space and Enter flips, checked semantics, focus, loaded stylesheet and completed switch animation pass in both themes. All 64 contrast checks pass, including explicit shadow-root text/control targets; 13 native documentation controls retain their geometry. Fifty page/theme/viewport cases, navigation/history, local scrolling and clipboard equality pass. Screenshots cover desktop/mobile and both themes.
- Formatting, architecture checks and normal commit-hook lint pass. Existing runtime suites were not repeated for unchanged library code; packed tests and published-package browser checks cover this example. Screen-reader/device validation remains as recorded in the ledger.

Two integration failures were corrected before green: Astro initially used the classic React JSX transform for the new TSX module, and the first contrast extension discarded shadow-root selector metadata. The docs JSX configuration and the checker now preserve the intended inputs; missing live-demo contrast targets fail explicitly. No checks were suppressed. Screenshot capture waits for the switch's completed transition.

## Separate renderer observation

A focused first run using `aria-checked={ctx.isOn}` reproduced a missing attribute for false. Existing `packages/ignite-renderer/src/renderers/jsx/renderer.ts` removes every false-valued property before attribute serialization. This is a separate `blocking_correctness` finding for boolean ARIA inputs in the renderer, outside the authorized docs implementation. The final example uses the supported string serialization `String(ctx.isOn)` and verifies both values; this docs candidate does not depend on a runtime fix. No renderer amendment or patch was made.

## Custody and review

Task-local package installs, ZIP extraction projects, generated site/export output, logs and screenshots remain local review evidence. Existing package outputs and unrelated worktrees were preserved. Chromium and local Git metadata require normal sandbox escalation. Focused tests take under a second; docs builds about five seconds. Browser repeats followed concrete integration/checker corrections. New dependencies are confined to documentation consumption and ZIP generation.

Preview: <http://127.0.0.1:4323/ignite-element/#build-a-component>. The [ledger](ledger.md) keeps this page awaiting review and all later content queued. Review the light-switch experience and its source before moving to Sources.
