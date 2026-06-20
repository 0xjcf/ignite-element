# docs(beta.7): add a Rendering concept page (ignite-jsx vs lit authoring, jsxImportSource homes, config-free auto-detect, vanilla-JS support) + reframe advanced-config renderer selection around auto-detect + migration note + align the React host-app guide with the Option 2 split and IgniteReactRef. Design: docs/renderer-selection.md

## Source
Created with `fas create-task` on 2026-06-19.

## Problem
docs(beta.7): add a Rendering concept page (ignite-jsx vs lit authoring, jsxImportSource homes, config-free auto-detect, vanilla-JS support) + reframe advanced-config renderer selection around auto-detect + migration note + align the React host-app guide with the Option 2 split and IgniteReactRef. Design: docs/renderer-selection.md

## Acceptance criteria
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- docs/site/src/content/docs/concepts/rendering.mdx
- docs/site/astro.config.mjs
- docs/site/src/content/docs/api/advanced-config.mdx
- docs/site/src/content/docs/migration/v3.mdx
- docs/site/src/content/docs/guides/host-app-integration.mdx
- docs/site/src/content/docs/getting-started/installation.mdx
- .changeset/lit-renderer-autodetect.md
- docs/renderer-selection.md
- packages/ignite-renderer/src/renderers/AutoDetectRenderStrategy.ts
- packages/ignite-element/src/tests/renderers/autoDetectRenderStrategy.test.ts

## Scope Amendments
- Type: scope-refresh
- Added at: 2026-06-19
- Trigger: correctness: public lit import path was ignite-element/renderers/lit (removed v3 subpath)
- Reason: Corrected the lit registration path to @ignite-element/renderer/lit across the new docs AND Task B's changeset/design-doc/comments; fixed stale 'lit needs advanced config' framing in installation.mdx.
- Added paths: docs/site/src/content/docs/getting-started/installation.mdx, .changeset/lit-renderer-autodetect.md, docs/renderer-selection.md, packages/ignite-renderer/src/renderers/AutoDetectRenderStrategy.ts, packages/ignite-element/src/tests/renderers/autoDetectRenderStrategy.test.ts

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
