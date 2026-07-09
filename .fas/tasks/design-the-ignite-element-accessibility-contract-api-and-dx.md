# Design projection contracts and behavior-first interface DX

## Source
Created with `fas create-task` on 2026-07-09.

## Problem
Produce the architecture/DX design before implementation for Ignite as a projection runtime over behavior contracts. Treat v3 beta as the breaking-change window: prefer clean projection vocabulary/API over compatibility aliases if the design accepts it. Define ProjectionRequest, ProjectionSpec, ProjectionInstance, ProjectionContext, a projection registry, and deterministic projection-selection hooks. Specify how voice/agent inputs request known projection types rather than generating raw UI code; compare native JSX-only guidance, helper utilities/guardrails, optional component primitives, and projection registry/selection surfaces; explain visual, voice, assistive, and agent/non-visual interface use cases; define what can be proven headlessly versus only in rendered DOM; preserve actor-web behavior graph alignment without making Ignite own execution topology.

## Acceptance criteria
- Design doc defines ProjectionRequest, ProjectionSpec, ProjectionInstance, ProjectionContext, projection registry semantics, and deterministic projection-selection hooks.
- Design doc compares native JSX-only guidance, helper utilities/guardrails, optional component primitives, and projection registry/selection surfaces, then recommends one v3 path.
- The design distinguishes agent-created ProjectionRequests from Ignite-resolved ProjectionSpecs and explicitly rejects raw generated UI code as the default path.
- The design treats v3 beta as a breaking-change window and prefers clean projection vocabulary/API over compatibility aliases when the accepted design requires a public rename.
- The recommended shape avoids a mandatory top-level accessibility callback unless the comparison proves it is necessary.
- The recommended shape preserves Ignite's state/view/commands/effects separation and actor-web behavior graph alignment.
- The design explains what is testable headlessly, what can power voice/agent/non-visual interfaces, and what only rendered DOM can prove.
- The design explicitly defaults to native elements first and ARIA only where needed.
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
- docs/projection-runtime.md
- docs/accessibility-by-default.md
- docs/site/src/content/docs/guides/accessibility-first.mdx

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
