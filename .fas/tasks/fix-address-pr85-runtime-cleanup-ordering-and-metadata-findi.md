# fix: address PR85 runtime cleanup ordering and metadata findings

## Source
Created with `fas create-task` on 2026-07-06.

## Problem
CodeRabbit flagged that shared direct-runtime teardown could mask successful
results, skip unconditional shared state reset when cleanup throws, and use a
single active boolean that breaks with overlapping shared commands. The same
review identified a host-context gap in test helper reads, a stale pnpm flag in
the nested-child-router README, and a placeholder FAS brief from the prior
follow-up.

## Acceptance criteria
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-element/src/IgniteElementFactory.ts
- packages/ignite-element/src/runtime/agent.ts
- packages/ignite-element/src/tests/IgniteElementFactory.test.ts
- .fas/tasks/examples-add-worked-apps-form-with-validation-nested-child-r.md
- .fas/tasks/fix-address-coderabbit-closeout-findings-for-v3-examples-epi.md

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
