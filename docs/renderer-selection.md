# Design: config-free lit renderer selection (auto-detect)

## Status

Accepted (2026-06-19). **Additive.** Selects the lit-html render strategy
config-free, so a `html\`…\`` view renders without `ignite.config.ts`. Part of
`docs/v3-api-consistency.md` (the config-free philosophy).

## Context

ignite resolves **one** render strategy per element, eagerly, in
`resolveConfiguredRenderStrategy()` — before any view runs — defaulting to
`ignite-jsx`. The lit strategy is used only when explicitly selected via
`ignite.config.ts` (`renderer: "lit"`) loaded by `igniteConfigVitePlugin`.

v3 hides `ignite.config.ts` (advanced-only), so there is **no config-free way to
select lit**. A lit-html view that only imports `renderers/lit` — which
*registers* but does not *select* the strategy — hits the ignite-jsx strategy and
renders `<!--ignite-unknown-->`: a silent blank. The mobx adapter example is the
live proof (verified: shadow root `<ignite-jsx-root><!--ignite-unknown--></ignite-jsx-root>`,
a fully blank page, despite lit-html loading in dev mode).

### Why not a pragma

A pragma was considered and rejected. `@jsxImportSource` only redirects the JSX
**authoring runtime** at compile time; it cannot select a **runtime** render
strategy. ignite-jsx's pragma "just works" only because ignite-jsx is *also* the
default strategy, so authored output and strategy align by accident. lit-html is
tagged-template-native — a `TemplateResult` depends on the static
template-strings identity for lit's caching/diffing — so it cannot be expressed
as a swappable per-call jsx-runtime without a heavy build-time JSX→`` html`…` ``
transform. A `/** @litRenderer */` comment is stripped before runtime and would
likewise need a build plugin. Auto-detect needs neither — the lit `TemplateResult`
**is** the signal, exactly as the ignite-jsx view object is the signal its
strategy renders.

## Decision

The **config-free default** resolution auto-detects the view output:

- a lit `TemplateResult` (brand `_$litType$`) → the `lit` strategy;
- anything else → `ignite-jsx` (the unchanged default).

An explicit `renderer` in `ignite.config.ts` still wins — auto-detect only
applies on the config-free path, so the advanced override is untouched.

Mechanism: a thin `AutoDetectRenderStrategy` wraps the built-in strategies. It
**eagerly attaches `ignite-jsx`** (preserving today's exact timing for the common
case) and switches to the lit strategy on the first render whose output is a lit
`TemplateResult` **and** the lit strategy is registered. If a lit `TemplateResult`
is returned but the lit strategy is not registered, it falls back to `ignite-jsx`
(the pre-existing behavior) rather than throwing — so components that author
throwaway lit views without selecting lit are unaffected. Importing
`ignite-element/renderers/lit` is what upgrades such a view to the lit strategy.

## Consequences

- `html\`…\`` views render config-free — no `ignite.config.ts`, no plugin, no
  pragma. The mobx example renders **unchanged**.
- The config-free default render path goes through a one-layer wrapper. For
  ignite-jsx views the wrapper attaches ignite-jsx eagerly (identical timing and
  behavior) and never switches — zero observable change. Only lit views switch,
  once, on first render.
- Backward-compatible: a lit view rendered without registering the lit strategy
  falls back to `ignite-jsx` exactly as before — no new throw or warning. Importing
  `ignite-element/renderers/lit` is what upgrades it to the lit strategy.
- A component is expected to use one renderer for its lifetime; the detector
  routes per render and stabilizes after the first.

## Alternatives considered

- **Per-core `renderer: "lit"` option** — explicit, typed, no plugin, but one
  opt-in line per core. Config-free; could layer on top of this later.
- **Build-plugin pragma** (`/** @litRenderer */`) — adds the build plugin v3's
  config-free path avoids.
- **`@jsxImportSource ignite-element/lit`** — not viable: lit is not jsx-native
  (see "Why not a pragma").
