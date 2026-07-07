# BREAKING (v3 cutover): uniform view/effects context = { snapshot } only (drop the spread) per docs/view-context-canonica

## Source
Created with `fas create-task` on 2026-06-18.

## Problem
Implement docs/view-context-canonicalization.md. Drop the createProjectionFactory spread ({ ...snapshot, snapshot }); the view (and effects) callback receives a single uniform { snapshot } arg with one data path (snapshot.*). Audit FacadeViewCallback / ViewContext typing and the headless getView projection. Update examples/docs still using { context }. BREAKING. MUST land in the SAME beta as event-shape + expectState rename, one goodway migration note. Decision locked 2026-06-18: { snapshot }-only (no convenience alias). Design: docs/view-context-canonicalization.md.

## Acceptance criteria
- The change is verified and does not introduce regressions.
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
- packages/ignite-core/src/RenderArgs.ts
- packages/ignite-element/src/createProjectionFactory.ts
- packages/ignite-element/src/tests/IgniteCore.test.ts
- packages/ignite-element/src/tests/createComponentFactory.test.ts
- packages/ignite-element/src/tests/react/igniteReact.test.tsx
- packages/ignite-element/src/tests/types/actor-web-emitted-events.types.test.ts
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- packages/ignite-element/src/tests/types/igniteReact.types.test.ts
- packages/ignite-element/src/tests/types/xstate-emitted-events.types.test.ts
- examples/agents/smart-home/src/actor-web-home.ts
- examples/apps/spa-router/README.md
- examples/frameworks/react/src/counter.ignite.tsx
- examples/frameworks/vue/src/toggle.ignite.ts
- docs/view-context-canonicalization.md
- docs/site/scripts/check-doc-examples.mjs
- docs/site/src/content/docs/api/ignite-core.mdx
- docs/site/src/content/docs/concepts/the-ignite-model.mdx
- docs/site/src/content/docs/guides/actor-web.mdx
- docs/site/src/content/docs/guides/agent-runtime-v3.mdx
- docs/site/src/content/docs/guides/routing.mdx
- docs/site/src/content/docs/guides/testing.mdx
- docs/site/src/content/docs/index.mdx
- docs/site/src/content/docs/migration/v3.mdx
- packages/ignite-element/README.md
- .changeset/view-context-snapshot-spread.md

## Scope Amendments
- 2026-07-07: scope refresh found no genuinely new affected paths to promote.
  `packages/ignite-element/src/createProjectionFactory.ts` and
  `packages/ignite-element/src/tests/types/igniteCore.types.test.ts` were already
  listed in affected files above, so no separate promotion is recorded.

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
