# add workflow trace assertions and serializable story snapshots

## Source
Created with `fas create-task` on 2026-05-26.

## Problem
Follow-up from inspector runtime investigation. Agent runtime already exposes record(), trace(), lifecycle(), and summary(), but docs/site agent-runtime-v3 still lists workflow assertions and serializable trace format as a remaining gap. Add matcher or helper support for story traces usable from Vitest and Playwright without requiring DOM selectors.

## Acceptance criteria
- Story traces can be asserted with a stable helper or matcher without brittle full-array manual expectations.
- Trace output has a documented serializable shape suitable for snapshots and reporter output.
- Focused runtime/testing tests and docs cover the helper.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-element/src/testing.ts
- packages/ignite-element/src/types/agent.ts
- packages/ignite-element/src/tests/testing.test.ts
- docs/site/src/content/docs/guides/agent-runtime-v3.mdx
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- packages/ignite-element/src/examples/xstate/xstateAgentRuntimeShowcase.tsx
- packages/ignite-element/src/index.ts
- packages/ignite-element/src/xstate.ts
- packages/ignite-element/src/redux.ts
- packages/ignite-element/src/mobx.ts
- packages/ignite-element/src/actor-web.ts
- packages/ignite-element/src/examples/xstate/README.md
- docs/site/src/content/docs/api/ignite-core.mdx
- packages/ignite-element/README.md
- packages/ignite-element/tests/xstate-agent-runtime.spec.ts
- .changeset/v3-public-api-boundary.md
- packages/ignite-element/CHANGELOG.md

## Scope Amendments
- Type: validation-fix
- Added at: 2026-05-27
- Trigger: public execute() types do not match async runtime implementation
- Reason: Type contract alignment requires updating the public type assertions that verify IgniteAgentRuntime.execute() and IgniteStory.execute().
- Added paths: packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- Evidence source: user-report
- Evidence: user-report | packages/ignite-element/src/types/agent.ts | Root confirmed runtime executeCommand/story.execute are async while public types still advertise synchronous return values.
- Accuracy signal: high
- Follow-up needed: Keep runtime behavior unchanged; only align public contracts, docs, and type assertions.

- Type: validation-fix
- Added at: 2026-05-27
- Trigger: public execute() promise contract breaks package example typecheck
- Reason: The xstate agent runtime showcase consumes execute().events synchronously and must await the Promise-returning public contract to keep package typecheck green.
- Added paths: packages/ignite-element/src/examples/xstate/xstateAgentRuntimeShowcase.tsx
- Evidence source: typecheck
- Evidence: typecheck | packages/ignite-element/src/examples/xstate/xstateAgentRuntimeShowcase.tsx | pnpm typecheck failed after aligning execute() return types because the example accesses .events on the returned Promise.
- Accuracy signal: high
- Follow-up needed: Keep the example behavior the same and only await execute() where it reads the execution result.

- Type: review-fix
- Added at: 2026-05-28
- Trigger: reviewer found snapshot types missing from public entrypoints and stale async examples
- Reason: Review fixes require exporting the new serializable snapshot types from supported entrypoints and correcting public examples to show await for async runtime/story APIs.
- Added paths: packages/ignite-element/src/index.ts, packages/ignite-element/src/xstate.ts, packages/ignite-element/src/redux.ts, packages/ignite-element/src/mobx.ts, packages/ignite-element/src/actor-web.ts, packages/ignite-element/src/examples/xstate/README.md, docs/site/src/content/docs/api/ignite-core.mdx
- Evidence source: reviewer
- Evidence: reviewer | packages/ignite-element/src/types/agent.ts | IgniteStoryTraceSnapshotEntry, IgniteStoryTraceSnapshot, and IgniteStorySnapshot exist in agent types but were not re-exported from supported package entrypoints; rendered examples still showed sync execute/until calls.
- Accuracy signal: high
- Follow-up needed: Keep runtime behavior unchanged; limit changes to public exports, examples, docs, and type coverage.

- Type: review-fix
- Added at: 2026-05-28
- Trigger: reviewer found stale async runtime examples and Playwright harness contracts
- Reason: Review fixes require updating package README examples and Playwright runtime harness types/calls to match Promise-returning execute() and until() contracts.
- Added paths: packages/ignite-element/README.md, packages/ignite-element/tests/xstate-agent-runtime.spec.ts
- Evidence source: reviewer
- Evidence: reviewer | packages/ignite-element/tests/xstate-agent-runtime.spec.ts | Harness typed execute() and until() synchronously and used sync story calls inside page.evaluate; package README also showed sync execute/story usage.
- Accuracy signal: high
- Follow-up needed: Keep runtime behavior unchanged; limit changes to docs, e2e harness contract, and snapshot type honesty.

- Type: review-fix
- Added at: 2026-05-28
- Trigger: reviewer requested release metadata for public TypeScript contract changes
- Reason: Release metadata must document Promise-returning execute/story contracts and serializable IgniteSchemaValue-based story snapshot types.
- Added paths: .changeset/v3-public-api-boundary.md, packages/ignite-element/CHANGELOG.md
- Evidence source: reviewer
- Evidence: reviewer | .changeset/v3-public-api-boundary.md | Existing major changeset and changelog are the repo-local release note surfaces for v3 public API boundary changes.
- Accuracy signal: high
- Follow-up needed: Keep edits to release metadata only unless markdown/typecheck gates require a mechanical fix.

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
