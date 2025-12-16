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
