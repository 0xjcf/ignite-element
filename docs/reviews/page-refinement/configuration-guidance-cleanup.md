# Configuration guidance cleanup

## Scope and starting identity

The Operator requested moving old configuration guidance into the migration
guide, removing the reminder from Views, and checking other pages for drift.

- Branch: `fas/docs-getting-started-source`.
- Starting commit: `a2e630bb8cbd6493b981956cb18fdc73e851a7c7`.
- Starting tree: `93d6882ded0b5dba6c1c332044d8c2e8421f1e0f`.
- Starting state: clean.

## Correction and evidence

Removed the unnecessary plugin/config reminder from Views and similar wording
from the agent-runtime guide, seven example READMEs and four supporting README
references. The XState README also referred to a nonexistent configuration file;
that entry and its outdated unscoped renderer snippet now give way to the
canonical advanced reference. Renderer and styling references likewise link to
that reference instead of duplicating obsolete configuration snippets.

The stable-v2 migration guide explains removal of the old config-loader plugin
wiring. It permits removing a configuration file used only for the default JSX
renderer, while preserving any stylesheet or renderer settings still needed.

Current public source still exports `defineIgniteConfig` and `getIgniteConfig`
from `@ignite-element/renderer`. Neither the facade nor the renderer export map
exposes the old config-loader plugins. The advanced reference retains the valid
optional API, explicitly loads the module, identifies the filename as a
convention and supplies the direct dependency installation command. This pass
does not claim that all renderer configuration has been removed.

A search of current site pages leaves `ignite.config.ts` only in the v2-to-v3
migration guide and the optional advanced reference, apart from legacy route
identifiers and historical v1-to-v2 guidance. The frozen v2 archive and historical
design/review records are unchanged. Linked example READMEs no longer contain
`ignite.config.ts`, `config-free` or config-loader reminders.

## Validation

- Formatting and Markdown checks: passed.
- Documentation snippets: 25 blocks typechecked; one existing fragment and seven
  explicitly excluded blocks remain unchanged.
- Documentation publication policy: all 299 tests and the contract checker passed.
- Site build: 68 pages and agent exports generated successfully.
- Internal links and fragments: all 3,025 references passed.
- Handbook: seven tests, 29 legacy mappings and canonical download/export checks
  passed.
- Astro: zero errors, zero warnings, one existing unused-variable hint.
- Inspected the built Views page and current agent export: the removed reminders
  are absent and the new migration instructions are present.
- `git diff --check`: passed.

## Custody and limits

Only documentation changed. Existing ignored build output was refreshed for the
local preview. No dependencies were installed, runtime tests added, or runtime
suites repeated for this prose correction. Validation took less than a minute;
there was no package release or deployment operation.

The parked documentation branch remains clean at
`1cfc2310557e9ed602c6e7f9524e9827e45f4dbc`, tree
`14689a7da715fa2cfde41745438f7485bbb34b5d`.

Getting started awaits re-review. Sources awaits review. Views remains queued.
