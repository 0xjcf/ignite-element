# Fix example runtime test lanes before next igniteTools task

## Source
Created with `fas create-task` on 2026-06-29.

## Problem
Phase B closeout made the root `npm run test` lane run only the package tests plus
the smart-home example test directly. That was a tactical fix for PR #71, but it
does not cover the rest of the top-level example runtime tests and leaves FAS
verification tied to one example's Vite config.

Top-level `examples/` are intentionally not pnpm workspace members. Keep that
model intact and add an explicit example runtime-test lane before continuing to
the next igniteTools dependency-chain task.

## Acceptance criteria
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- Root package tests can run without directly embedding the smart-home example
  Vitest command.
- A dedicated example runtime-test lane discovers and runs top-level examples
  that contain runtime tests.
- A full test lane covers package tests plus all discovered example runtime
  tests.
- FAS verification uses the full lane so changed example runtime tests are not
  missed.
- CI covers example runtime tests, not only example typechecks.
- Top-level examples remain outside `pnpm-workspace.yaml`.

## Proposed solution
- Restore the root `test` script to package tests.
- Add a root `test:examples` script backed by `scripts/test-examples.mjs`.
- Add a root `test:full` script for package tests plus example runtime tests.
- Point `.fas-config.json` `testCommand` at the full lane.
- Update CI to run the new example runtime-test lane.
- Keep examples self-contained and avoid adding them as workspace packages.

## Alternatives considered
- Making examples pnpm workspace members: rejected for this task because the
  current examples model is intentionally self-contained and the CI typecheck
  lane already treats them that way.
- Keeping smart-home embedded in root `test`: rejected because other examples
  have runtime tests and the lane should not depend on one example path.

## Affected files
- package.json
- scripts/test-examples.mjs
- scripts/__tests__/test-examples.test.mjs
- .fas-config.json
- .github/workflows/ci.yml
- examples/**/package.json
- examples/**/*.test.ts

## Scope Amendments
- None.

## Implementation plan
- Inspect existing example package scripts and Vitest configs.
- Add the discovery script for top-level example runtime tests.
- Wire root package/full/example test scripts and FAS test command.
- Wire CI to run the example runtime-test lane.
- Refresh stale local test-map entries only as ignored FAS runtime state; do not
  force-add generated `.fas/index/` data.

## Verification plan
- Run `npm run test:examples`.
- Run `npm run test:full`.
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Example runtime tests use self-contained package roots, so the script must run
  Vitest from each example without requiring workspace membership.
- CI should not run release-only jobs or alter the existing example typecheck
  lane's install semantics.
- `.fas/index/test-map.json` is ignored FAS runtime state; durable coverage must
  come from committed test-lane scripts/config and CI wiring.

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
