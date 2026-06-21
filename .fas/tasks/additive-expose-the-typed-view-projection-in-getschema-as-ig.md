# additive: expose the typed view projection in getSchema() as IgniteAgentSchema.view (mirrors the snapshot field) so agen

## Source
Created with `fas create-task` on 2026-06-20.

## Problem
additive: expose the typed view projection in getSchema() as IgniteAgentSchema.view (mirrors the snapshot field) so agents introspect the derived view shape they bind to, not just the raw snapshot; Phase-1 additive non-breaking; depends on the typed-view threading task-1781971975611 for the typed projection

## Acceptance criteria
- The new functionality works as described.
- Existing behavior is not broken.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-element/src/types/schema.ts (add `view` to IgniteAgentSchema; likely a SchemaView generic mirroring SchemaState)
- packages/ignite-element/src/runtime/schema.ts (project the runtime view into the schema value via the same toSchemaValue path used for state)
- packages/ignite-element/src/types/agent.ts (thread the View projection into IgniteAgentSchema<…> on the runtime surface)
- packages/ignite-element/src/runtime/agent.ts (getSchema() builds `view` alongside `snapshot`)
- packages/ignite-element/src/tests/types/*.types.test.ts (type-level: getSchema().view sees the projection's keys)
- packages/ignite-element/src/tests/*.test.ts (unit: getSchema() includes the projected view)
- .changeset (additive minor; "ignite-element")
- (refine the exact set during planning)

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
- task-1781971975611 (typed-view threading) — the view projection must be TYPED end-to-end (surfaced through IgniteCoreReturn -> IgniteAgentRuntime View) before getSchema().view can expose it typed; otherwise schema.view falls back to a loose Record<string,unknown>.
- Coordinates with the Phase-2 `state`->`snapshot` schema rename (task-1781818974159): if this lands first it adds `view` beside `state` (then `state`->`snapshot` in the cutover); if after, beside `snapshot`. Either order is fine — additive.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
