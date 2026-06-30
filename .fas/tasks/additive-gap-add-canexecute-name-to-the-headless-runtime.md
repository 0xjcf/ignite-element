# ADDITIVE (gap): add canExecute(name) to the headless runtime per docs/v3-api-consistency.md. A command-availability query for UI-guard patterns (disable a control when a command is unavailable), backed by the same info getSchema() exposes. Affected files: packages/ignite-element/src/runtime/agent.ts, packages/ignite-element/src/types/agent.ts, tests, and a short docs note in guides/agent-runtime-v3.mdx.

## Source
Created with `fas create-task` on 2026-06-18.

## Problem
ADDITIVE (gap): add canExecute(name) to the headless runtime per docs/v3-api-consistency.md. A command-availability query for UI-guard patterns (disable a control when a command is unavailable), backed by the same info getSchema() exposes. Affected files: packages/ignite-element/src/runtime/agent.ts, packages/ignite-element/src/types/agent.ts, tests, and a short docs note in guides/agent-runtime-v3.mdx.

## Automation admission
- Expected operator value: Improves operator leverage around "ADDITIVE (gap): add canExecute(name) to the headless runtime per docs/v3-api-consistency.md. A command-availability query for UI-guard patterns (disable a control when a command is unavailable), backed by the same info getSchema() exposes. Affected files: packages/ignite-element/src/runtime/agent.ts, packages/ignite-element/src/types/agent.ts, tests, and a short docs note in guides/agent-runtime-v3.mdx." by reducing manual coordination, repetitive execution, or trust gaps.
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
- .changeset/tall-buckets-execute.md
- .fas/TASKS.md
- docs/can-execute.md
- docs/ignite-tools.md
- docs/site/src/content/docs/api/command-metadata.mdx
- docs/site/src/content/docs/api/headless-runtime.mdx
- docs/site/src/content/docs/guides/agent-runtime-v3.mdx
- docs/v3-api-consistency.md
- docs/v3-stable-roadmap.md
- examples/agents/smart-home/GAPS.md
- packages/ignite-adapters/src/types.ts
- packages/ignite-adapters/src/xstate.ts
- packages/ignite-core/src/RenderArgs.ts
- packages/ignite-core/src/index.ts
- packages/ignite-element/src/RenderArgs.ts
- packages/ignite-element/src/createProjectionFactory.ts
- packages/ignite-element/src/igniteCore/createIgniteComponentFactory.ts
- packages/ignite-element/src/igniteCore/types.ts
- packages/ignite-element/src/runtime/agent.ts
- packages/ignite-element/src/testing.ts
- packages/ignite-element/src/tests/agent-runtime-headless-node.test.ts
- packages/ignite-element/src/tests/testing.test.ts
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- packages/ignite-element/src/tests/types/testing.types.test.ts
- packages/ignite-element/src/tools/igniteTools.ts
- packages/ignite-element/src/tools/types.ts
- packages/ignite-element/src/types/agent.ts
- packages/ignite-element/src/types/schema.ts

## Scope Amendments
- Expanded from the original runtime/types/tests/docs note because
  `CommandMetadata` is defined in `@ignite-element/core`, adapter config types
  must thread the adapter snapshot into command metadata, `igniteTools` consumes
  the optional runtime availability method, and the public minor API requires
  docs, smart-home gap tracker, and changeset updates.

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
