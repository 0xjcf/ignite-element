# Implement projection registry, behavior metadata, and native JSX guardrails

## Source
Created with `fas create-task` on 2026-07-09.

## Problem
After the projection-contract design is accepted, implement the minimal runtime/JSX support needed for accessible-by-default and non-visual interfaces. Prefer projection registry/selection hooks, behavior metadata, and guardrails over a new accessibility projection callback or bundled component library. Preserve functional-core boundaries, avoid DOM scraping, and keep JSX/native elements as the browser accessibility layer while exposing behavior facts and projection specs that tests, agents, voice adapters, and DOM validation can consume. Because this is pre-stable v3 beta, use the clean accepted vocabulary/API instead of compatibility aliases unless the design explicitly justifies them.

## Acceptance criteria
- The implementation does not add a mandatory top-level accessibility callback unless the accepted design requires it.
- ProjectionRequest, ProjectionSpec, ProjectionInstance, ProjectionContext, registry, and selection semantics match the accepted design if those surfaces are accepted.
- Command/action metadata can describe labels, descriptions, availability, validation/error messages, focus intent, and announcements without DOM access.
- JSX/runtime guardrails encourage native interactive elements and avoid silently inaccessible command rendering.
- Public naming follows the accepted v3 beta projection vocabulary without deprecated compatibility aliases unless explicitly justified by the design.
- Runtime behavior is deterministic and covered by focused package tests.
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
- packages/ignite-core/src
- packages/ignite-element/src/RenderArgs.ts
- packages/ignite-element/src/createProjectionFactory.ts
- packages/ignite-element/src/IgniteElementFactory.ts
- packages/ignite-element/src/actor-web.ts
- packages/ignite-element/src/renderers/jsx
- packages/ignite-element/src/testing.ts
- packages/ignite-element/src/tests

## Scope Amendments
- Type: superseded-before-implementation
- Added at: 2026-07-09
- Trigger: The provisional implementation demonstrated that registry/config integration and behavior presentation metadata would spread through every igniteCore adapter, factory, schema, and entrypoint.
- Reason: The user rejected that API direction. All uncommitted source changes were restored, and queue task task-1783610917796 was superseded by task-1783650880370.
- Evidence source: architecture discussion and clean-tree restoration
- Evidence path: `.fas/tasks/implement-internal-dynamic-projection-pipeline-and-llm-autho.md`
- Accuracy signal: high
- Follow-up: Keep this brief for audit history only; do not use it for implementation guidance.

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
