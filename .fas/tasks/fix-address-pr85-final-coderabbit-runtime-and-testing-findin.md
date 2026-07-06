# fix: address PR85 final CodeRabbit runtime and testing findings

## Source
Created with `fas create-task` on 2026-07-06.

## Problem
CodeRabbit's final PR85 closeout review found six issues: shared runtime access
release can mask successful results, shared teardown must reset state even when
cleanup throws, overlapping shared direct commands need count-based tracking,
test helper state/view reads must honor the supplied host, the nested router
README uses an unsupported pnpm flag, and the previous runtime cleanup FAS brief
still had a placeholder problem statement.

## Acceptance criteria
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- Shared direct-runtime access uses count-based tracking and guarded release.
- Shared teardown resets cached shared/runtime state even if facade cleanup or
  adapter stop throws.
- `igniteTest(..., { host })` uses the host for `given`, `expectState` fallback,
  and `expectView` reads.
- The nested-child-router README install command uses supported pnpm flags.
- The prior PR85 runtime cleanup FAS brief states the concrete issue.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-element/src/IgniteElementFactory.ts
- packages/ignite-element/src/runtime/agent.ts
- packages/ignite-element/src/tests/IgniteElementFactory.test.ts
- packages/ignite-element/src/testing.ts
- packages/ignite-element/src/tests/testing.test.ts
- examples/apps/nested-child-router/README.md
- .fas/tasks/fix-address-pr85-runtime-cleanup-ordering-and-metadata-findi.md

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
