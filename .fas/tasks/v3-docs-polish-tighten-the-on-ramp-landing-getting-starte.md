# v3 docs polish: tighten the on-ramp (landing, getting-started, compatibility)

## Source
Created with `fas create-task` on 2026-06-04.

## Problem
Phase 2 restructure. Trim index.mdx to a real landing: hero + one teaser snippet + two doors ('Build a UI' / 'Build for agents') + links; stop re-embedding install/first-component/comparison (move 'why/comparison' to overview/what-is-ignite-element). Merge getting-started/project-setup INTO getting-started/installation (as a 'project checklist'). Trim getting-started/first-component (drop 'use it anywhere' host section to a link). Extract the compatibility matrix to its own small api/compatibility.mdx reference page (agent-friendly), sourced from peerDependencies. Update sidebar. Only current v3 docs; examples pass the guardrail. Spike report: .fas/state/spikes/v3-docs-ia-audit.md

## Acceptance criteria
- index.mdx is a lean landing (hero + one teaser + two audience doors + links); it no longer re-embeds installation or the full first-component example
- getting-started/project-setup is merged into installation; first-component is trimmed (host-integration content linked, not embedded)
- The compatibility matrix lives on its own api/compatibility reference page, sourced from peerDependencies
- Sidebar updated; doc examples pass the guardrail; docs:build green
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- docs/site/src/content/docs/index.mdx (trimmed to a lean landing: hero + one teaser + two audience doors + links)
- docs/site/src/content/docs/getting-started/installation.mdx (compat matrix → pointer; absorbed project-setup as a project checklist)
- docs/site/src/content/docs/getting-started/first-component.mdx (trimmed "use it anywhere"; fixed project-setup link)
- docs/site/src/content/docs/getting-started/project-setup.mdx (deleted — merged into installation)
- docs/site/src/content/docs/api/compatibility.mdx (new — compatibility matrix from peerDependencies)
- docs/site/src/content/docs/overview/what-is-ignite-element.mdx (absorbed the why/comparison/performance sections from the old landing)
- docs/site/astro.config.mjs
- docs/site/scripts/doc-examples-baseline.json (baseline burned 3 → 0; the index teaser now typechecks)

## Scope Amendments
- Merging `getting-started/project-setup` into installation necessarily DELETES project-setup; added to Affected files. Inbound link in first-component repointed to the installation project checklist.
- Moving the landing's why/comparison/performance content into `overview/what-is-ignite-element` (per the brief: "move why/comparison to overview/what-is-ignite-element") edits that page; added to Affected files.
- The lean landing's teaser now typechecks against the real API, so the three pre-existing `index.mdx` doc-example baseline entries became stale. Regenerated `doc-examples-baseline.json` (now empty / 0 known issues) and formatted it with Biome. This drives the doc guardrail baseline to 0.

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
