# chore: restructure ignite-element examples into adapters/frameworks/apps subfolders (in place)

## Source
Created with `fas create-task` on 2026-06-18.

## Problem
Decomposed from task-1781724737259 (engineering-credibility omnibus). Mechanical, in-place restructure of packages/ignite-element/src/examples so the folder is legible across its three axes BEFORE adding framework-interop demos. Keep examples under src/examples (they are NOT published; ignite-element ships files:[dist]) and sub-group: git mv xstate/redux/mobx into adapters/, spa-router into apps/, and reserve frameworks/ for the upcoming React/Vue/Svelte/Angular demos (created by the interop task; actor-web adapter example added later). Update everything that hardcodes the old example paths: (1) package.json npm scripts examples:xstate/redux/mobx (cd src/examples/<name>); (2) tsconfig.json exclude (~L14), tsconfig.examples.json include (~L13), playwright.config.ts vite-serve path (~L76), vitest.config.ts exclude glob (~L93); (3) each moved example's relative source-aliases in vite.config.ts + tsconfig.json (nesting one level deeper adds one ../); (4) doc links: docs/examples/README.md table, docs/site routing.mdx (~L16) and index.mdx (~L88) GitHub tree/main path segments. DO NOT rewrite .fas historical provenance (.fas/TASKS.md, .fas/tasks/*.md) or the frozen docs/site .../2.x/ archive. Verify: each moved example's in-place install typecheck passes (npm install + tsc per example), the xstate example still serves under playwright, vitest still excludes examples, and verify.sh --full is green. No source/runtime code changes.

## Acceptance criteria
- External behavior is unchanged.
- The refactored code meets the stated goal.
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
- packages/ignite-element/src/examples/adapters/xstate
- packages/ignite-element/src/examples/adapters/redux
- packages/ignite-element/src/examples/adapters/mobx
- packages/ignite-element/src/examples/apps/spa-router
- packages/ignite-element/package.json
- packages/ignite-element/playwright.config.ts
- packages/ignite-element/src/tests/IgniteCore.test.ts
- packages/ignite-element/src/tests/IgniteRedux.test.tsx
- packages/ignite-element/src/tests/adapters/ReduxAdapter.test.ts
- packages/ignite-element/src/tests/adapters/XStateAdapter.test.ts
- packages/ignite-element/src/tests/config-states-deprecation.test.ts
- packages/ignite-element/src/tests/runtime-deprecations.test.ts
- packages/ignite-element/src/tests/testing.test.ts
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- packages/ignite-element/src/tests/types/testing.types.test.ts
- docs/examples/README.md
- docs/site/src/content/docs/guides/routing.mdx
- docs/site/src/content/docs/index.mdx
- packages/ignite-element/src/examples/xstate
- packages/ignite-element/src/examples/redux
- packages/ignite-element/src/examples/mobx
- packages/ignite-element/src/examples/spa-router
- docs/v3-api-consistency.md
- docs/effects-change-detection.md

## Scope Amendments
- Type: scope-refresh-promotion
- Added at: 2026-06-18
- Trigger: dirty-low-confidence-scope
- Reason: Promoted dirty low-confidence or dependency-reachable task-packet path(s) into affected scope.
- Added paths: packages/ignite-element/src/tests/types/igniteCore.types.test.ts, packages/ignite-element/src/tests/testing.test.ts, packages/ignite-element/src/tests/IgniteCore.test.ts, packages/ignite-element/src/tests/types/testing.types.test.ts
- Evidence source: task-packet dirty scope promotion
- Evidence: task-packet dirty scope promotion | .fas/state/task-packet.json | Promoted dirty path(s): packages/ignite-element/src/tests/types/igniteCore.types.test.ts, packages/ignite-element/src/tests/testing.test.ts, packages/ignite-element/src/tests/IgniteCore.test.ts, packages/ignite-element/src/tests/types/testing.types.test.ts
- Accuracy signal: Path was dirty in git status and present in task-packet low-confidence/dependency-reachable scope.

- Type: scope-refresh
- Added at: 2026-06-18
- Added paths: packages/ignite-element/src/examples/xstate, packages/ignite-element/src/examples/redux, packages/ignite-element/src/examples/mobx, packages/ignite-element/src/examples/spa-router, docs/v3-api-consistency.md, docs/effects-change-detection.md

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
