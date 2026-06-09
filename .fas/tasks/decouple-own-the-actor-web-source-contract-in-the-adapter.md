# [decouple] Own the actor-web source contract in the adapter; keep ignite-element core standalone

## Source
Created with `fas create-task` on 2026-06-09.

## Problem
Epic: actor-web-decoupling (correlate by the [decouple] title prefix across actor-web, ignite-element, fas-studio, and FAS). Design doc: ../actor-web/docs/actor-web-decoupling-design.md (Seam A). CONTEXT: ignite-element core must stay usable WITHOUT actor-web (like any state-management lib). Today the actor-web<->ignite source contract is defined twice: actor-web has an Ignite* bridge (being deleted), and ignite-element's @ignite-element/adapters (src/adapters/ActorWebAdapter.ts, ~568 lines) defines a structural ActorWeb* hand-copy and the full IgniteAdapter binding. TARGET: ignite-element KEEPS its ActorWebAdapter as the canonical seam owner. actor-web is renaming its source types to NEUTRAL Actor* names (ActorReadModelSource/ActorCommandSource/ActorSource) and deleting integration/ignite-element-bridge.ts. WORK (this repo): (1) confirm @ignite-element/adapters remains the seam owner and ignite-element CORE has zero actor-web dependency; (2) OPTIONALLY replace the structural hand-copy with an optional peerDependency import of actor-web's neutral source types — but ONLY in @ignite-element/adapters (never @ignite-element/core or the element package), so core stays standalone; the dependency edge must be ignite-adapters -> actor-web, never ignite-core -> actor-web; (3) update/redirect the local 'unify actor-web source contract import canonical types from...' task, whose original premise (import actor-web as a peerDep into ignite core) is the WRONG direction. SEQUENCE: after actor-web ships neutral source types.

## Acceptance criteria
- ignite-element core/element packages have zero dependency on actor-web; only the optional @ignite-element/adapters package may reference it (optional peerDep) and only if option 2 is taken
- ActorWebAdapter remains the canonical actor-web<->ignite seam owner
- the prior 'unify actor-web source contract' task is updated to the ignite-adapters -> actor-web direction (not ignite-core -> actor-web)
- ignite-element verification passes; 'use ignite-element without actor-web' still holds
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
- packages/ignite-element/src/tests/core-decoupling.test.ts

## Scope Amendments
- Type: scope-definition
- Added at: 2026-06-09
- Trigger: brief had 'Scope unknown'; precondition (actor-web neutral types) not met so item-2 deferred
- Reason: This-repo scope now: (item 1) lock in the already-correct decoupling with core-decoupling.test.ts (core+element no external actor-web). Item 2 (adopt neutral types as optional peerDep) deferred to task-1781026742685 — gated on actor-web shipping neutral Actor* types. Item 3 (redirect wrong-direction I1) done via queue supersede + C8 record correction.
- Added paths: packages/ignite-element/src/tests/core-decoupling.test.ts

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
