# test(examples): include new worked apps in example runtime lane fixture

## Source
Created with `fas create-task` on 2026-07-05.

## Problem
Full epic verification failed because scripts/__tests__/test-examples.test.mjs still expected the pre-Task-1 runtime-test example list. The discovery script now correctly finds examples/apps/dashboard-with-shared-state and examples/apps/nested-child-router, and package.json already covers them in test:full. Update the script test fixture so the full lane validates the current discovered runtime-test examples.


## Acceptance criteria
- scripts/__tests__/test-examples.test.mjs expects dashboard-with-shared-state and nested-child-router in the discovered runtime-test example list.
- The covered-package validation fixture includes every runtime-tested example currently discovered by scripts/test-examples.mjs.
- Focused node test for scripts/__tests__/test-examples.test.mjs passes.
- Full verify can be rerun after this closeout fix.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Establish the intended approach at a design level before editing code.

## Alternatives considered
- None recorded yet.

## Affected files
- scripts/__tests__/test-examples.test.mjs
- .fas-config.json

## Scope Amendments
- Type: closeout-fix
- Added at: 2026-07-05
- Trigger: full-verify-failure
- Reason: The shared full verify failed because the example runtime-test fixture did not include the two worked apps added earlier in this batch.
- Added paths: scripts/__tests__/test-examples.test.mjs
- Evidence source: .fas/state/verification/latest.log
- Evidence: .fas/state/verification/latest.log | .fas/state/verification/latest.log | test:scripts expected six runtime-tested examples while scripts/test-examples.mjs discovered dashboard-with-shared-state and nested-child-router as additional runtime-tested examples.
- Accuracy signal: package.json test:full already includes both new example roots, so only the script test fixture is stale.

- Type: closeout-fix
- Added at: 2026-07-05
- Trigger: full-verify-failure
- Reason: The FAS testCommand duplicated the example runtime covered-package list and stayed stale after package.json test:full was updated.
- Added paths: .fas-config.json
- Evidence source: .fas/state/verification/latest.log
- Evidence: .fas/state/verification/latest.log | .fas/state/verification/latest.log | test:examples missed dashboard-with-shared-state and nested-child-router when invoked through .fas-config.json testCommand.
- Accuracy signal: package.json already routes test:full through the complete covered-package list, so FAS should delegate to npm run test:full instead of duplicating that list.

## Implementation plan
- Update expectedExampleRoots in scripts/__tests__/test-examples.test.mjs to include the two new worked apps in sorted discovery order.
- Run the focused script test and fas validate-task before committing.

## Verification plan
- Run node --test scripts/__tests__/test-examples.test.mjs.
- Run fas validate-task.
- Rerun .fas/scripts/verify.sh --full at batch closeout.

## Risks
- Identify regression, rollout, or coordination risks during planning.

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
