# Docs: Actor-Web producer->igniteCore mapping (readModel/comm

## Source
Created with `fas create-task` on 2026-06-06.

## Problem
Spike addendum: .fas/state/spikes/agent-runtime-api-review.md (I2, C10). In docs/site/src/content/docs/guides/actor-web.mdx (+ api/advanced-config / api/ignite-core where relevant): document that topology.actors.X.readModel(opts)->igniteCore source, commandSource(opts)->commandSource, sourceHandle(opts)->source bundle; that opts is gateway/transport config { gateway:{url,scope?,auth?}, streamId?, createSocket?, clientVersion? } and NOT actor identity; and the two merge paths (pass commandSource() alone as source, or createActorWebSourceHandle(readModel, commandSource)). Clarify the silent-drop failure mode when a read-only source has no commandSource. Do NOT edit 2.x archive.

## Acceptance criteria
- guide documents the readModel/commandSource/sourceHandle -> igniteCore mapping and opts shape
- merge paths documented
- read-only-without-commandSource failure mode documented
- 2.x untouched
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
- docs/site/src/content/docs/guides/actor-web.mdx
- docs/site/src/content/docs/api/advanced-config.mdx
- docs/site/src/content/docs/api/ignite-core.mdx

## Scope Amendments
- None.

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
