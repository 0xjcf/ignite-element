# harden ActorWebAdapter replay dedupe for cloned snapshots an

## Source
Created with `fas create-task` on 2026-05-26.

## Problem
Follow-up from fix runtime correctness blockers from CodeRabbit domain review. SRE/reviewer accepted current implementation but noted initial replay suppression is still reference-sensitive for cloned snapshot identity and non-initial dedupe relies on object references for in-place mutation sources. Investigate Actor-Web source guarantees, then harden dedupe or document constraints with focused tests.

## Acceptance criteria
- Covers cloned snapshot graphs without duplicate initial subscriber notifications when semantically equivalent.
- Preserves legitimate later snapshot and transport updates.
- Documents or tests behavior for in-place mutation sources.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-adapters/src/adapters/ActorWebAdapter.ts
- packages/ignite-element/src/tests/adapters/ActorWebAdapter.test.ts

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
