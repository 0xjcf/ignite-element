# bound injectStyles pending root retention and invalid-style 

## Source
Created with `fas create-task` on 2026-05-26.

## Problem
Follow-up from fix runtime correctness blockers from CodeRabbit domain review. SRE/reviewer accepted current implementation but noted injectStyles keeps pending roots in a strong Set while styles remain unset or invalid, which can retain detached roots and repeat warning noise. Investigate a bounded cleanup or retry policy without regressing late global style injection.

## Acceptance criteria
- Pending roots remain retryable after invalid configuration but do not accumulate unbounded detached roots.
- Repeated invalid style flushes do not create excessive warning noise.
- Late valid css configuration still injects exactly once per root.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-renderer/src/injectStyles.ts
- packages/ignite-element/src/tests/injectStyles.test.ts

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
