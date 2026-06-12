# Stable-v3 follow-up: remove deprecated runtime/config surface at changeset pre exit

## Source
Created with `fas create-task` on 2026-06-06.

## Problem
Spike: .fas/state/spikes/agent-runtime-api-review.md (T7, depends on T6 — deferred until the stable cut). At changeset pre exit (3.0.0): remove the @deprecated getState()/watch()/subscribe() runtime aliases, the states config alias, the IgniteAgentStateListener alias, and all associated dev-warns. Update tests and live v3 docs to drop alias references. Author a breaking (major-at-stable) changeset. Keep getSnapshot/watchSnapshot/view, execute().state, getSchema().state, and the igniteTest state vocabulary. AUDIT AMENDMENTS (pre-stable-v3 audit 2026-06-11, F3+F4): (1) ALSO REMOVE forceRender() from IgniteElement (owner decision 2026-06-11) — src/IgniteElement.ts:128 carries a stale 'TODO: REMOVE in v2.0'; delete the method, its console.warn guards, and its tests in src/tests/IgniteElement.test.tsx (it is referenced nowhere else in source or docs). (2) Removal-site inventory checklist (7 sites): src/types/agent.ts:202 getState, :209 subscribe (NOTE: its @deprecated tag is missing the 'Removed at stable v3' marker — do not miss it), :217 watch, :182 IgniteAgentStateListener type; 'states'->'view' config alias at src/createProjectionFactory.ts:52, src/igniteCore/createIgniteComponentFactory.ts:34, src/igniteCore/actor-web.ts:94; plus the IgniteAgentStateListener re-export at src/index.ts:33. Drop the dedicated deprecation test lanes (runtime-deprecations.test.ts, config-states-deprecation.test.ts) or convert them to removed-surface assertions.


## Automation admission
- Expected operator value: Improves operator leverage around "Stable-v3 follow-up: remove deprecated runtime/config surface at changeset pre exit" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- no @deprecated getState/watch/subscribe/states remain
- tests+docs reference only canonical names
- breaking changeset authored
- getSnapshot/view and state vocabulary retained
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
- packages/ignite-element/src/types/agent.ts
- packages/ignite-element/src/runtime/agent.ts
- packages/ignite-element/src/createProjectionFactory.ts
- packages/ignite-element/src/igniteCore/types.ts
- packages/ignite-element/src/IgniteElement.ts
- packages/ignite-element/src/index.ts
- packages/ignite-element/src/igniteCore/createIgniteComponentFactory.ts
- packages/ignite-element/src/igniteCore/actor-web.ts
- packages/ignite-element/src/tests/IgniteElement.test.tsx

## Scope Amendments
- Type: scope-refresh
- Added at: 2026-06-12
- Added paths: packages/ignite-element/src/IgniteElement.ts, packages/ignite-element/src/types/agent.ts, packages/ignite-element/src/index.ts, packages/ignite-element/src/createProjectionFactory.ts, packages/ignite-element/src/igniteCore/createIgniteComponentFactory.ts, packages/ignite-element/src/igniteCore/actor-web.ts, packages/ignite-element/src/tests/IgniteElement.test.tsx

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
