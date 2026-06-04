# Ignite Element Docs (Astro + Starlight)

This is the v2 documentation site for Ignite Element. It lives under `docs/site` and uses Starlight with a dark-first theme inspired by the XState docs.

## Project structure

- `astro.config.mjs` – Starlight config, sidebar, theme, logo, and metadata.
- `src/content/docs` – All docs content (organized by IA: overview, getting-started, concepts, API, guides, migration, community).
- `src/assets` – Logo and any shared imagery.
- `src/styles/theme.css` – Custom theming to match the desired XState-like feel.

## Commands

Run from repo root:

| Command | Action |
| --- | --- |
| `pnpm --filter docs-site dev` | Start the docs dev server at `localhost:4321`. |
| `pnpm --filter docs-site build` | Build the static site to `docs/site/dist`. |
| `pnpm --filter docs-site preview` | Preview the built site locally. |

You can also use root shortcuts: `pnpm docs:dev`, `pnpm docs:build`, `pnpm docs:preview`.

## Theme contrast + geometry guardrail

[`scripts/check-contrast.mjs`](./scripts/check-contrast.mjs) renders the **built** site in headless Chromium and runs two checks in one pass:

- **Contrast** — WCAG AA for key chrome (version/theme selects, search trigger) and content (sidebar, TOC, asides, inline code, links) in **both** themes; fails when a UI control is below 3:1 or text below 4.5:1.
- **Geometry** — interactive controls (header selects, search, hero buttons) must use the `--radius-*` scale and have non-zero horizontal padding; fails on un-tokenized geometry or a zero-padding control (the "Build your first component" button shipped 0px once).

It renders the real page (not just the tokens), so it catches un-themed defaults and Astro-scoped component overrides — the failure mode that made the version picker and search trigger invisible in dark mode. The contrast math composites alpha over the nearest opaque backdrop, so translucent fills (inline code, asides) are measured against what actually renders.

| Command | Action |
| --- | --- |
| `pnpm --filter docs-site test:contrast` | Build, then check contrast (one-shot). |
| `pnpm --filter docs-site check:contrast` | Check an existing `dist/` build. |

Install the Chromium binary once with `pnpm --filter docs-site exec playwright install chromium`. CI runs this automatically on PRs touching `docs/site/**` (see [`.github/workflows/docs-contrast.yml`](../../.github/workflows/docs-contrast.yml)).

## Doc code-example guardrail

[`scripts/check-doc-examples.mjs`](./scripts/check-doc-examples.mjs) extracts the TypeScript/TSX code fences from the current (v3) docs and typechecks them against the **real** `ignite-element` package types, so examples can't drift from the public API (it catches things like an example referencing a `snapshot` variable that isn't in scope, or a `effects` callback shape the adapter doesn't accept).

It is tolerant of doc realities: external imports and app-relative paths resolve to `any`, names from earlier blocks on the same page are in scope, and un-parseable fragments are skipped. Opt a block out with a `no-check` fence meta or a leading `// docs-check: skip`.

A baseline ([`scripts/doc-examples-baseline.json`](./scripts/doc-examples-baseline.json)) lists known failures in the current docs so the gate is green today while failing on any **new** drift; burning it down is the docs-accuracy work. Regenerate it with `node scripts/check-doc-examples.mjs --update-baseline`.

| Command | Action |
| --- | --- |
| `pnpm --filter docs-site check:docs` | Typecheck all doc code examples (no build needed). |

CI runs this on PRs touching `docs/site/**` or `packages/**` (the same [docs-contrast workflow](../../.github/workflows/docs-contrast.yml)).
