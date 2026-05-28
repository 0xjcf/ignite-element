# Clarify Actor-Web projection integration for Ignite v3

## Source
Created with `fas create-task` on 2026-05-28.

## Problem
Define and implement the v3 public story for using Ignite Element with Actor-Web without making Ignite the orchestrator. The API and docs should show when to use ignite-element/xstate versus ignite-element/actor-web, how projection/read-model state flows into Ignite, how explicit request commands cross the runtime boundary, and how transport/runtime metadata stays outside ordinary UI concerns unless the app opts into it.

## Acceptance criteria
- Docs and examples explain when to use xstate versus actor-web entrypoints in projection-first apps.
- A tested Actor-Web projection example or helper demonstrates read-model consumption plus explicit request commands without runtime ownership leakage.
- Public exports/typesVersions remain allowlisted and do not expose internal adapter implementation APIs.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-element/src/actor-web.ts
- packages/ignite-element/src/igniteCore/actor-web.ts
- packages/ignite-adapters/src/adapters/ActorWebAdapter.ts
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- docs/site/src/content/docs/concepts/state-adapters.mdx
- packages/ignite-element/README.md
- packages/ignite-element/scripts/verify-exports.mjs

## Scope Amendments
- Type: verification blocker
- Added at: 2026-05-28
- Trigger: SRE package build gate failed verify:exports
- Reason: The stable JSX runtime export snapshot expected stale j helper even though source exports only Fragment, jsx, and jsxs.
- Added paths: packages/ignite-element/scripts/verify-exports.mjs
- Evidence source: pnpm --filter ignite-element run build
- Evidence: pnpm --filter ignite-element run build | packages/ignite-element/scripts/verify-exports.mjs | verify:exports failed until stale j expectation was removed
- Accuracy signal: package build and source export inspection
- Follow-up needed: None

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
