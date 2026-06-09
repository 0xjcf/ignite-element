# Runtime+types: add getSnapshot/watchSnapshot canonical + deprecate getState/watch/subscribe

## Source
Created with `fas create-task` on 2026-06-06.

## Problem
Spike: .fas/state/spikes/agent-runtime-api-review.md (D2/D3/D7). Add canonical getSnapshot() and watchSnapshot() to IgniteAgentRuntime (types/agent.ts) and the runtime object (runtime/agent.ts L396-431). Keep getState()/watch() as @deprecated aliases delegating to the new methods, each emitting a once-per-process dev console.warn (NODE_ENV!=='production'). Add the same once-per-process dev-warn to the existing @deprecated subscribe alias (currently 'subscribe: on', silent). Add IgniteAgentSnapshotListener type; keep IgniteAgentStateListener as a deprecated alias. Do NOT change getView/watchView, execute().state, getSchema().state, or the { unsubscribe() } subscription shape. Update internal calls in testing.ts to getSnapshot while keeping getState in the structural Runtime constraints so deprecated runtimes still type-check.

## Automation admission
- Expected operator value: Improves operator leverage around "Runtime+types: add getSnapshot/watchSnapshot canonical + deprecate getState/watch/subscribe" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- getSnapshot()/watchSnapshot() exist and return identical values to getState()/watch()
- getState()/watch()/subscribe() still work and emit a once-per-process dev-only console.warn
- no production console.warn
- getView/watchView/getSchema/execute unchanged
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
- packages/ignite-element/src/testing.ts
- packages/ignite-element/src/tests/runtime-deprecations.test.ts
- .changeset/pre.json

## Scope Amendments
- Type: test-coverage + formatting
- Added at: 2026-06-08
- Trigger: closeout-readiness flagged 1 unexpected + 1 extra test file
- Reason: Added focused deprecation-warning test (runtime-deprecations.test.ts) for the new canonical/alias surface; restored tab indentation in .changeset/pre.json — a pre-existing whole-repo format-gate failure from branch commit 885da94 (whitespace-only, matches origin, no value change).
- Added paths: packages/ignite-element/src/tests/runtime-deprecations.test.ts, .changeset/pre.json

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
