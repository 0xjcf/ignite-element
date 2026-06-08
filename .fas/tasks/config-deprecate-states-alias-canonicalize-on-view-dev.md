# Config: deprecate states alias, canonicalize on view (+ dev 

## Source
Created with `fas create-task` on 2026-06-06.

## Problem
Spike: .fas/state/spikes/agent-runtime-api-review.md (D1). Add @deprecated JSDoc to the 'states' config key everywhere it is declared: igniteCore/types.ts (ActorWebConfig), igniteCore/actor-web.ts, and the core FacadeStatesCallback type in @ignite-element/core. In createProjectionFactory.ts emit a once-per-process dev console.warn when 'states' is provided and 'view' is absent (view already takes precedence at L249-259). Canonical projection key is 'view' (richer ViewContext). IMPORTANT: do NOT touch the 'states:' key inside examples/xstate/*Machine.ts — that is XState's own machine states, not the igniteCore alias.

## Acceptance criteria
- states config key is @deprecated in JSDoc and still functions
- dev-only once-per-process warn when states used without view
- XState machine 'states' definitions untouched
- view remains canonical with ViewContext
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
- packages/ignite-element/src/createProjectionFactory.ts
- packages/ignite-element/src/igniteCore/types.ts
- packages/ignite-element/src/igniteCore/actor-web.ts
- packages/ignite-core/src/RenderArgs.ts

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
