# Beta.6 docs accuracy + polish. P0 (correctness): the docs-site prose still teaches the pre-beta.6 cleanup/ownership default and is now inaccurate. Update to beta.6 semantics — 'cleanup' defaults to FALSE for shared (consumer-owned) sources (an already-live actor/store/observable/source passed to igniteCore); shared adapters are NOT released on element-refcount-zero by default (they live for the core's lifetime); adapters never stop or close a source they did not create (generalized ownsActor->ownsSource). Affected docs: docs/site/src/content/docs/concepts/the-ignite-model.mdx (cleanup/scope sections ~17,45,225,226), docs/site/src/content/docs/api/ignite-core.mdx (~32,40,45), docs/site/src/content/docs/guides/routing.mdx (~165 — drop the now-redundant cleanup:false guidance; explain the new default), docs/site/src/content/docs/migration/v2.mdx (~19,89,90,96), docs/site/src/content/docs/getting-started/first-component.mdx (~87), docs/site/src/content/docs/guides/testing.mdx (~135 — Ignite-owned vs consumer-owned teardown wording). P1 (UX): add a /guides/ index landing page (bare /guides/ currently 404s while individual guides are live). P2 (depth): add a 'When to choose Ignite / comparisons' page surfacing existing positioning, and deepen the getSchema() docs (guides/agent-runtime-v3.mdx and/or api) with example output for the agent angle. Verify via the docs build + contrast/markdownlint/code-example guardrails. Do NOT modify archived docs under docs/site/src/content/docs/2.x/.

## Source
Created with `fas create-task` on 2026-06-17.

## Problem
Beta.6 docs accuracy + polish. P0 (correctness): the docs-site prose still teaches the pre-beta.6 cleanup/ownership default and is now inaccurate. Update to beta.6 semantics — 'cleanup' defaults to FALSE for shared (consumer-owned) sources (an already-live actor/store/observable/source passed to igniteCore); shared adapters are NOT released on element-refcount-zero by default (they live for the core's lifetime); adapters never stop or close a source they did not create (generalized ownsActor->ownsSource). Affected docs: docs/site/src/content/docs/concepts/the-ignite-model.mdx (cleanup/scope sections ~17,45,225,226), docs/site/src/content/docs/api/ignite-core.mdx (~32,40,45), docs/site/src/content/docs/guides/routing.mdx (~165 — drop the now-redundant cleanup:false guidance; explain the new default), docs/site/src/content/docs/migration/v2.mdx (~19,89,90,96), docs/site/src/content/docs/getting-started/first-component.mdx (~87), docs/site/src/content/docs/guides/testing.mdx (~135 — Ignite-owned vs consumer-owned teardown wording). P1 (UX): add a /guides/ index landing page (bare /guides/ currently 404s while individual guides are live). P2 (depth): add a 'When to choose Ignite / comparisons' page surfacing existing positioning, and deepen the getSchema() docs (guides/agent-runtime-v3.mdx and/or api) with example output for the agent angle. Verify via the docs build + contrast/markdownlint/code-example guardrails. Do NOT modify archived docs under docs/site/src/content/docs/2.x/.

## Automation admission
- Expected operator value: Improves operator leverage around "Beta.6 docs accuracy + polish. P0 (correctness): the docs-site prose still teaches the pre-beta.6 cleanup/ownership default and is now inaccurate. Update to beta.6 semantics — 'cleanup' defaults to FALSE for shared (consumer-owned) sources (an already-live actor/store/observable/source passed to igniteCore); shared adapters are NOT released on element-refcount-zero by default (they live for the core's lifetime); adapters never stop or close a source they did not create (generalized ownsActor->ownsSource). Affected docs: docs/site/src/content/docs/concepts/the-ignite-model.mdx (cleanup/scope sections ~17,45,225,226), docs/site/src/content/docs/api/ignite-core.mdx (~32,40,45), docs/site/src/content/docs/guides/routing.mdx (~165 — drop the now-redundant cleanup:false guidance; explain the new default), docs/site/src/content/docs/migration/v2.mdx (~19,89,90,96), docs/site/src/content/docs/getting-started/first-component.mdx (~87), docs/site/src/content/docs/guides/testing.mdx (~135 — Ignite-owned vs consumer-owned teardown wording). P1 (UX): add a /guides/ index landing page (bare /guides/ currently 404s while individual guides are live). P2 (depth): add a 'When to choose Ignite / comparisons' page surfacing existing positioning, and deepen the getSchema() docs (guides/agent-runtime-v3.mdx and/or api) with example output for the agent angle. Verify via the docs build + contrast/markdownlint/code-example guardrails. Do NOT modify archived docs under docs/site/src/content/docs/2.x/." by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- The new functionality works as described.
- Existing behavior is not broken.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- docs/site/src/content/docs/concepts/the-ignite-model.mdx
- docs/site/src/content/docs/api/ignite-core.mdx
- docs/site/src/content/docs/getting-started/first-component.mdx
- docs/site/src/content/docs/guides/routing.mdx
- docs/site/src/content/docs/guides/testing.mdx
- docs/site/src/content/docs/migration/v2.mdx
- docs/site/src/content/docs/guides/index.mdx
- docs/site/astro.config.mjs
- .changeset/pre.json

## Scope Amendments
- .changeset/pre.json: release-generated by beta.6 `changeset version`; reformatted to satisfy the whole-repo Biome format gate (no semantic change).

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
