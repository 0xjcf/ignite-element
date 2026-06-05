# v3 docs polish: consolidate Advanced config + renderers into api/advanced-config (expose ignite.config.ts)

## Source
Created with `fas create-task` on 2026-06-04.

## Problem
Phase 2 restructure. Merge api/define-ignite-config + api/renderers + concepts/configuration + concepts/renderers (reference parts) + the legacy bits of guides/tooling into ONE reference page api/advanced-config.mdx. CRITICAL new content: document the ignite.config.ts FILE wiring explicitly (placement, import/export, bundler integration) — currently missing. Cover all defineIgniteConfig options, renderer selection + legacy lit, and the render-strategy primitives (registerRenderStrategy/resolveRenderStrategy/getRegisteredRenderStrategies/getIgniteConfig, already @public). Leave one-line pointers from the model page. Update astro.config.mjs sidebar; add redirects if supported. Only current v3 docs; all TS examples pass docs/site/scripts/check-doc-examples.mjs. Spike report: .fas/state/spikes/v3-docs-ia-audit.md

## Acceptance criteria
- A single api/advanced-config page is the canonical owner of ignite.config.ts (file placement + import + bundler wiring), defineIgniteConfig options, renderer selection/legacy lit, and the render-strategy primitives
- concepts/configuration, concepts/renderers, api/define-ignite-config, api/renderers and the legacy parts of guides/tooling no longer duplicate config/renderer reference content (merged, redirected, or reduced to a one-line pointer)
- Sidebar updated in astro.config.mjs; no broken internal links; no change to the stable public API
- All doc code examples pass the doc-typecheck guardrail and npm run docs:build is green (markdownlint included)
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- docs/site/src/content/docs/api/advanced-config.mdx
- docs/site/astro.config.mjs
- docs/site/src/content/docs/api/define-ignite-config.mdx (deleted — merged into advanced-config)
- docs/site/src/content/docs/api/renderers.mdx (deleted — merged into advanced-config)
- docs/site/src/content/docs/concepts/configuration.mdx (deleted — reference content merged into advanced-config; conceptual pointer handled by The Ignite model task)
- docs/site/src/content/docs/concepts/renderers.mdx (deleted — reference content merged into advanced-config; conceptual pointer handled by The Ignite model task)
- docs/site/src/content/docs/guides/tooling.mdx (deleted — legacy config/renderer notes merged into advanced-config; JSX/bundler entrypoints already in installation)
- docs/site/src/content/docs/getting-started/installation.mdx (link fix only — collapsed three removed-page links into one advanced-config link)
- docs/site/src/content/docs/index.mdx (link fix only — repointed removed concepts/renderers link to advanced-config)

## Scope Amendments
- Merging five pages into `api/advanced-config` necessarily DELETES the merged sources (`api/define-ignite-config`, `api/renderers`, `concepts/configuration`, `concepts/renderers`, `guides/tooling`); the brief listed only the new page + sidebar. Deletions added to Affected files.
- Two inbound link fixes (`getting-started/installation.mdx`, `index.mdx`) were required to satisfy the "no broken internal links" acceptance criterion after the deletions. Content-only edits to those pages are reserved for their own restructure tasks (T4/T5).

## Implementation plan
- Convert the supplied context into a scoped implementation plan before editing.
- Refresh affected-file scope before implementation if the generated hints are incomplete.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Validate generated scope, acceptance criteria, and verification evidence before closeout to avoid workflow drift.

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
