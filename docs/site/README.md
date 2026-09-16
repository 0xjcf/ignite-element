# Ignite Element Docs (Astro + Starlight)

This is the v3 beta documentation site for Ignite Element, retaining the frozen `2.x` archive. It lives under `docs/site` and uses Starlight with a dark-first theme inspired by the XState docs.

## Project structure

- `astro.config.mjs` – Starlight config, sidebar, theme, logo, and metadata.
- `src/content/docs` – All docs content (eight primary handbook pages, supporting recipes/reference, migration, and archive).
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

Install the Chromium binary once with `pnpm --filter docs-site exec playwright install chromium`. CI runs this automatically on PRs touching `docs/site/**` (see [`.github/workflows/docs-contrast.yml`](../../../.github/workflows/docs-contrast.yml)).

## Doc code-example guardrail

[`scripts/check-doc-examples.mjs`](./scripts/check-doc-examples.mjs) extracts the TypeScript/TSX code fences from the current (v3) docs and typechecks them against the **real** `ignite-element` package types, so examples can't drift from the public API (it catches things like an example referencing a `snapshot` variable that isn't in scope, or a `effects` callback shape the adapter doesn't accept).

Declared ecosystem dependencies resolve to their real types and fail visibly when missing. Application placeholders and names from earlier blocks remain supported; unparseable fragments and explicit exclusions are reported separately. Publication validation independently inventories every TypeScript fence and checks the complete accounting record.

A baseline ([`scripts/doc-examples-baseline.json`](./scripts/doc-examples-baseline.json)) lists known failures in the current docs so the gate is green today while failing on any **new** drift; burning it down is the docs-accuracy work. Regenerate it with `node scripts/check-doc-examples.mjs --update-baseline`.

| Command | Action |
| --- | --- |
| `pnpm build && pnpm --filter docs-site check:docs` | Build workspace declarations, then typecheck doc examples. |

CI runs this on PRs touching `docs/site/**` or `packages/**` (the same [docs-contrast workflow](../../../.github/workflows/docs-contrast.yml)).

## Publication contract

Only `beta` may build and deploy Pages, including manual dispatch. Both jobs have
explicit beta guards; deploy depends on successful build. Main remains the
default-branch registration and contrast-PR-validation branch, not a deployment
owner. The existing Pages URL and version picker are retained.

The beta build runs `check:docs`, `check:publication`, `check:astro`, the docs
build, `check:versions:built`, and `check:links` before uploading `docs/site/dist`.
The publication policy independently rejects other deployment branches, unsafe
permissions/secrets/events, bypassed failures, and altered artifact wiring.
Version checks preserve exact v2 installs (`2.2.2`), current beta chrome, archived
routes and branding, and the beta.12 candidate's pending-publication disclosures.
Main's separate browser-audit harness is not part of Pages deployment; beta's
existing contrast/geometry check remains in its PR-validation workflow.

## Handbook validation

`pnpm --filter docs-site check:primary` packs the current built package family,
copies canonical files from `scripts/__tests__/fixtures/handbook` and the React example, and runs
strict web and no-DOM native consumers with `skipLibCheck: false`. It also runs
source/core/DOM/React tests and the existing React Native host fixture. These are
independent of the legacy per-fence guard's ambient placeholders and exclusions.

`pnpm --filter docs-site check:handbook` checks all built legacy destinations,
version selectors, banner links, and version-separated agent exports. The short
agent index links only the eight primary pages; the full v3 text and v2 archive
are separate files. Static legacy pages work without server redirect support.
