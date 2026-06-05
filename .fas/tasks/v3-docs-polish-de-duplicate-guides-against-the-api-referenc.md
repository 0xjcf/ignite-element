# v3 docs polish: de-duplicate guides against the API reference

## Source
Created with `fas create-task` on 2026-06-04.

## Problem
Phase 2 restructure. Make api/* the single canonical owner of runtime/testing/command-metadata facts. Trim guides/agent-runtime-v3 (retitle 'Build for agents') to a narrative walkthrough that LINKS to api/headless-runtime, api/command-metadata, api/testing-dsl instead of restating them. Trim api/ignite-core to factory signature+params (remove the duplicated runtime/testing/determinism sections; determinism now lives once in The Ignite model). Trim guides/testing (remove headless-runtime/replay restatement; add a short scenario-API pointer to api/testing-dsl). Merge guides/platform-contracts INTO guides/host-app-integration (one integration guide), moving styling bits to guides/styling. Update sidebar. Only current v3 docs; examples pass the guardrail. Full redundancy matrix in Spike report: .fas/state/spikes/v3-docs-ia-audit.md

## Acceptance criteria
- guides/agent-runtime-v3 ('Build for agents') is a narrative walkthrough with NO restated API; it links to the headless-runtime/command-metadata/testing-dsl reference pages
- api/ignite-core is trimmed to factory signature + params + links; the duplicated runtime/testing/determinism sections are removed (determinism lives once in The Ignite model)
- guides/platform-contracts is merged into guides/host-app-integration; styling content lives only in guides/styling
- guides/testing keeps setup + state + DOM tests and points to api/testing-dsl for the scenario API, with no headless-runtime restatement
- Sidebar updated; doc examples pass the guardrail; docs:build green; no stable-API doc break
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- docs/site/src/content/docs/guides/agent-runtime-v3.mdx (retitled "Build for agents"; trimmed to narrative + links)
- docs/site/src/content/docs/api/ignite-core.mdx (trimmed to factory signature/params; runtime/testing/determinism sections replaced with links)
- docs/site/src/content/docs/guides/host-app-integration.mdx (absorbed platform-contracts contract semantics)
- docs/site/src/content/docs/guides/styling.mdx (absorbed platform-contracts styling section; fixed link)
- docs/site/src/content/docs/guides/testing.mdx (removed headless-runtime/replay restatement; added pointer)
- docs/site/src/content/docs/guides/platform-contracts.mdx (deleted — merged into host-app-integration + styling)
- docs/site/astro.config.mjs
- docs/site/src/content/docs/index.mdx (link fix — dropped platform-contracts link)
- docs/site/src/content/docs/api/command-metadata.mdx (link label fix — Agent runtime v3 → Build for agents)
- docs/site/src/content/docs/api/testing-dsl.mdx (link label fix — Agent runtime v3 → Build for agents)
- docs/site/src/content/docs/api/headless-runtime.mdx (link label fix — Agent runtime v3 → Build for agents)

## Scope Amendments
- Merging `guides/platform-contracts` into `guides/host-app-integration` (contract semantics) and `guides/styling` (styling hooks) necessarily DELETES platform-contracts; the brief listed host-app-integration + styling as edit targets but not the deletion. Added to Affected files.
- `guides/agent-runtime-v3` keeps its slug (no broken inbound links) but is retitled "Build for agents"; the `#agent-readable-contracts` anchor is preserved.
- Link-only fixes in `index.mdx` (dropped platform-contracts link) and three api/* Related lists (relabeled "Agent runtime v3" → "Build for agents") were required to keep links valid/consistent after the merge and retitle.

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
