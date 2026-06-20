---
"@ignite-element/renderer": minor
"ignite-element": minor
---

Render lit-html views config-free — no `ignite.config.ts` required.

The config-free default render-strategy resolution now auto-detects the view output: a lit-html `TemplateResult` (when `@ignite-element/renderer/lit` is imported) routes to the `lit` strategy, and everything else routes to `ignite-jsx` (unchanged). Previously, selecting lit required `ignite.config.ts` plus the Vite config plugin; a lit-html view authored without it rendered a blank `<!--ignite-unknown-->`. An explicit `renderer` in `ignite.config.ts` still wins.

Backward-compatible: ignite-jsx views are unchanged (the wrapper attaches ignite-jsx eagerly and never switches), and a lit-html view rendered without registering the lit strategy still falls back to ignite-jsx exactly as before — no new throw or warning. See `docs/renderer-selection.md`.
