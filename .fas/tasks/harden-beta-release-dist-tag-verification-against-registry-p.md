# Harden beta release dist-tag verification against registry propagation lag

## Source
Created with `fas create-task` on 2026-07-18.

## Problem
The beta.9 publish and dist-tag writes succeeded, but the wrapper immediately read stale npm dist-tags and exited 1 with misleading OTP repair instructions. Make post-write verification force fresh registry reads, tolerate bounded propagation lag, and distinguish a persistent verification mismatch from an actual dist-tag write failure so successful releases do not report false failure.

## Acceptance criteria
- Post-write dist-tag reads explicitly prefer the online npm registry and retry a bounded number of transient stale snapshots.
- Verification succeeds without repair guidance when the expected tags converge within the retry budget.
- Persistent stale verification tells the operator to recheck live tags before applying repair commands, while an actual dist-tag write failure retains fresh-OTP repair guidance.
- Deterministic regression tests cover transient stale-then-converged reads and persistent mismatch behavior.
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
- scripts/release-beta.mjs
- scripts/release-beta.test.mjs

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
