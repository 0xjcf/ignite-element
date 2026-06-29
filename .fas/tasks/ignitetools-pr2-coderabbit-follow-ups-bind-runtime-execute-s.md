# igniteTools PR2 CodeRabbit follow-ups — bind runtime.execute, strict scalar value envelope, fix canExecute doc wording

## Source
Created with `fas create-task` on 2026-06-26.

## Problem
Three CodeRabbit findings on shipped PR2 code, out of the Phase A (DOM-free) scope. (1) igniteTools.ts: const execute = runtime.execute is unbound — bind it via runtime.execute.bind(runtime) like canExecute already is, else an execute that relies on this breaks when run() calls it; the current fake runtime uses an arrow so the gap is uncovered — add a class/this-based fake runtime regression test. (2) tools/scalar.ts: the scalar value envelope is not strict — { value: 7, extra: true } unwraps to 7, bypassing resolveCall validation; add additionalProperties:false on encode (toProviderInputSchema) and reject extra keys on decode (fromProviderInput) so a malformed provider envelope surfaces InvalidInput; add tests. (3) docs/ignite-tools.md: the observation note overpromises that canExecute re-gates the tool list as state changes, but igniteTools snapshots the manifest once — reword to say rebuild igniteTools() (or re-derive tools) to publish a fresh canExecute-gated manifest.

## Automation admission
- Expected operator value: Improves operator leverage around "igniteTools PR2 CodeRabbit follow-ups — bind runtime.execute, strict scalar value envelope, fix canExecute doc wording" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- runtime.execute bound before storing + a this/class-based regression test
- scalar value envelope strict on encode and decode + tests (extra keys -> InvalidInput)
- docs/ignite-tools.md canExecute re-gating wording corrected
- a changeset covers the behavior changes
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
- packages/ignite-element/src/tools/igniteTools.ts
- packages/ignite-element/src/tools/scalar.ts
- packages/ignite-element/src/tests/tools.test.ts
- packages/ignite-element/src/tests/tools.scalar.test.ts
- docs/ignite-tools.md

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
