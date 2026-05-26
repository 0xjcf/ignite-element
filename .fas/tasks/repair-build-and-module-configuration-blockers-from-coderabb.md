# simplify v3 build config and styling defaults

## Source

Created with `fas create-task` on 2026-05-22.

## Problem
Repair CodeRabbit build/config blockers while locking the v3 API direction for simplest Ignite Element UI/UX/DX: Ignite JSX is the default renderer, no public `ignite.config.ts` happy path, no required config auto-discovery or Vite/Webpack plugin for normal usage, and component styles should be authored as ordinary `<style>` tags inside Ignite JSX render output with CSS imported from `.css` or `.ts` files when desired. Existing blockers remain in scope: replace ESM-invalid `__dirname` usage in redux example Vite config, repair ignite-element `tsconfig.typecheck` path mappings, remove or make mode-aware hard-coded production `NODE_ENV` define, and assess dependency upgrade recommendations before lockfile changes.

## Acceptance criteria

- Redux example Vite config works under ESM without `__dirname`.
- ignite-element typecheck mappings resolve to real package or source paths and `pnpm run typecheck` passes.
- Build config no longer forces development builds into production `NODE_ENV`.
- Dependency upgrade recommendation is either safely implemented with lockfile verification or explicitly documented as deferred with current-version rationale.
- v3 docs/examples no longer recommend `ignite.config.ts` for the default path; Ignite JSX is documented as the default renderer with no renderer config.
- Default component styling is documented and tested through `<style>` in Ignite JSX render output, including CSS imported from external `.css` or `.ts` files as text.
- Lit and config-loader/plugin support are clearly marked legacy/advanced compatibility, not the first-read API.
- The design addresses style-node diffing/churn, CSS variable theming across shadow boundaries, and CSP implications for inline style tags.
- Run `pnpm run lint`, `pnpm run typecheck`, `pnpm test`, and `fas verify --full`.
- The work is tracked in `.fas/TASKS.md` and remains queued in `.fas/queue/tasks.json`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution

- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered

- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files

- packages/ignite-element/src/examples/redux/vite.config.ts
- packages/ignite-element/tsconfig.typecheck.json
- packages/ignite-element/vite.config.ts
- packages/ignite-renderer/src/config.ts
- packages/ignite-element/vitest.config.ts
- packages/ignite-element/src/tests/renderers/igniteJsxRenderStrategy.test.ts
- README.md
- docs/migrations/v2.0.0-ignite-jsx.md
- docs/site/src/content/docs/api/define-ignite-config.mdx
- docs/site/src/content/docs/api/renderers.mdx
- docs/site/src/content/docs/concepts/configuration.mdx
- docs/site/src/content/docs/concepts/renderers.mdx
- docs/site/src/content/docs/guides/styling.mdx
- docs/site/src/content/docs/guides/tooling.mdx
- docs/site/src/content/docs/index.mdx
- docs/site/src/content/docs/migration/v2.mdx
- docs/renderers/README.md
- docs/styling/README.md

## Scope Amendments

- Type: scope-refresh
- Added at: 2026-05-26
- Added paths: packages/ignite-element/src/examples/redux/vite.config.ts, packages/ignite-element/tsconfig.typecheck.json, packages/ignite-element/vite.config.ts, packages/ignite-renderer/src/config.ts, packages/ignite-element/src/tests/renderers/igniteJsxRenderStrategy.test.ts, README.md, docs/site/src/content/docs/index.mdx, docs/site/src/content/docs/migration/v2.mdx, docs/renderers/README.md, docs/styling/README.md
- Type: scope-refresh
- Added at: 2026-05-26
- Trigger: delegated review findings
- Reason: QA, SRE, and reviewer passes found additional public docs pages that contradicted the v3 config-free default API direction or referenced non-exported config imports. Dependency and plugin source changes were assessed and left untouched because no dependency upgrade or plugin behavior change was required.
- Added paths: packages/ignite-element/vitest.config.ts, docs/migrations/v2.0.0-ignite-jsx.md, docs/site/src/content/docs/api/define-ignite-config.mdx, docs/site/src/content/docs/api/renderers.mdx, docs/site/src/content/docs/concepts/configuration.mdx, docs/site/src/content/docs/concepts/renderers.mdx, docs/site/src/content/docs/guides/styling.mdx, docs/site/src/content/docs/guides/tooling.mdx

## Implementation plan

- Repair existing build/config blockers first so examples and typecheck are trustworthy.
- Shift v3 public docs/examples to no `ignite.config.ts` happy path, Ignite JSX default, and `<style>`-tag styling in render output.
- Audit config loader/plugin exports and decide whether to deprecate, move to legacy docs, or leave as advanced compatibility without default docs exposure.
- Add or adjust focused tests for style tag rendering/diff behavior if current coverage does not prove the target DX.
- Update migration/docs copy so v2 config guidance does not contradict the v3/default happy path.

## Verification plan

- Run focused tests for config/plugin and Ignite JSX style rendering changes.
- Run `pnpm run lint`, `pnpm run typecheck`, `pnpm test`, and `../FAS/cli/fas verify --full`.
- Build docs if docs-site sidebar/content changes are made.

## Risks

- Removing config-file guidance without a clear `<style>` and CSS import story would leave a styling gap for shadow DOM users.
- Lit users need an explicit compatibility path so v3 simplification does not become an accidental hard removal.
- Inline `<style>` examples need CSP caveats for strict host apps.
- Renderer diffing must avoid unnecessary style node churn on normal re-renders.

## Dependencies

- None known at task creation.

## Open questions

- None captured at task creation.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
