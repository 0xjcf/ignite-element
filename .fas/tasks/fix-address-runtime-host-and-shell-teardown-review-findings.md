# fix: address runtime host and shell teardown review findings

## Source
Created with `fas create-task` on 2026-07-05.

## Problem
CodeRabbit committed review returned two valid findings: restore the previous sharedRuntimeActive state when withRuntimeHost exits so shared cleanup can run again, and contain user teardown errors inside igniteShell deferred disconnect cleanup with shell-specific logging.

## Automation admission
- Expected operator value: Improves operator leverage around "fix: address runtime host and shell teardown review findings" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- withRuntimeHost restores runtimeHost, runtimeAdditionalArgs, and sharedRuntimeActive for normal, throwing, and promise-finally callbacks.
- igniteShell deferred teardown catches and logs user teardown errors without leaking an unhandled async exception while still clearing active/teardown state.
- Focused regressions cover both fixes.
- Focused validation and fas validate-task pass before batch snapshot.
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
- packages/ignite-element/src/IgniteElementFactory.ts
- packages/ignite-element/src/igniteShell.ts
- packages/ignite-element/src/tests/igniteShell.test.ts
- packages/ignite-element/src/tests/IgniteElementFactory.test.ts

## Scope Amendments
- Type: scope-change
- Added at: 2026-07-06
- Trigger: coderabbit-review
- Reason: withRuntimeHost sharedRuntimeActive cleanup regression is best covered beside existing shared cleanup tests with direct adapter stop assertions.
- Added paths: packages/ignite-element/src/tests/IgniteElementFactory.test.ts
- Evidence source: source inspection
- Evidence: source inspection | IgniteElementFactory.test.ts already covers cleanup:true shared adapter release; extending it avoids indirect testing-only assertions.
- Accuracy signal: CodeRabbit finding targets IgniteElementFactory with runtime host override state; testing.test.ts stayed out of implementation because direct adapter cleanup is not observable there.

- Type: scope-refresh-promotion
- Added at: 2026-07-06
- Trigger: dirty-low-confidence-scope
- Reason: Promoted dirty low-confidence or dependency-reachable task-packet path(s) into affected scope.
- Added paths: packages/ignite-element/src/IgniteElementFactory.ts
- Evidence source: task-packet dirty scope promotion
- Evidence: task-packet dirty scope promotion | .fas/state/task-packet.json | Promoted dirty path(s): packages/ignite-element/src/IgniteElementFactory.ts
- Accuracy signal: Path was dirty in git status and present in task-packet low-confidence/dependency-reachable scope.

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
