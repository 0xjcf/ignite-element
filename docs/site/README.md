# Ignite Element Docs (Astro + Starlight)

This is the prerelease v3 documentation site for Ignite Element, with the frozen stable-v2 documentation preserved under `/ignite-element/2.x/`. It lives under `docs/site` and uses Astro, Starlight, and `starlight-versions`.

The default public documentation is v3 beta. Install it with `ignite-element@beta` or exact `ignite-element@3.0.0-beta.11`; the consumer-facing stable tag remains `ignite-element@latest = 2.2.2`.

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
| `pnpm --filter docs-site check:versions` | Check source-level version routing, beta disclosure, installation, and immutable-link contracts. |
| `pnpm --filter docs-site check:versions:built` | Check built routes, canonical URLs, version labels, and LLM output. |
| `pnpm --filter docs-site check:publication` | Check workflow provisioning and permissions, frozen-v2 installs, and complete example accounting. |

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
| `pnpm --filter docs-site check:accessibility` | Run axe against representative v3 and archived-v2 pages in both themes. |
| `pnpm --filter docs-site check:astro` | Validate Astro content and typecheck site code. |
| `pnpm --filter docs-site check:links` | Check built internal routes, links, anchors, and assets. |
| `pnpm --filter docs-site check:links:external` | Also verify every unique external HTTP(S) link. |

Install the Chromium binary once with `pnpm --filter docs-site exec playwright install chromium`. CI runs this automatically on PRs touching `docs/site/**` (see [`.github/workflows/docs-contrast.yml`](../../.github/workflows/docs-contrast.yml)).

## Doc code-example guardrail

[`scripts/check-doc-examples.mjs`](./scripts/check-doc-examples.mjs) extracts the TypeScript/TSX code fences from the current (v3) docs and performs an exact-public-beta declaration compatibility check against the public `3.0.0-beta.11` package declarations, so examples cannot drift from the published beta API (it catches things like an example referencing a `snapshot` variable that isn't in scope, or an `effects` callback shape the adapter doesn't accept).

It is tolerant of doc realities: external imports and app-relative paths resolve to `any`, names from earlier blocks on the same page are in scope, and un-parseable fragments are skipped. Opt a block out with a `no-check` fence meta or a leading `// docs-check: skip`.

The validator reports every discovered TS/TSX fence as explicitly excluded, syntactically incomplete, or actually typechecked, and prints the complete exclusion inventory. An optional baseline ([`scripts/doc-examples-baseline.json`](./scripts/doc-examples-baseline.json)) can identify accepted diagnostics while failing on any **new** drift; the current baseline is empty. Regenerate it with `node scripts/check-doc-examples.mjs --update-baseline` only after an explicit review decision.

| Command | Action |
| --- | --- |
| `pnpm --filter docs-site check:docs` | Run the declaration-compatibility check and complete accounting for current doc examples (no build needed). |

CI runs this on PRs touching `docs/site/**` or `packages/**` (the same [docs-contrast workflow](../../.github/workflows/docs-contrast.yml)).
