# Bump redux + mobx to latest within current major (currency).

## Source
Created with `fas create-task` on 2026-06-17.

## Problem
Bump redux + mobx to latest within current major (currency). Update devDependencies in packages/ignite-adapters/package.json: '@reduxjs/toolkit' ^2.3.0 -> ^2.12.0 and 'mobx' ^6.13.5 -> ^6.16.1. Update examples: packages/ignite-element/src/examples/redux/package.json '@reduxjs/toolkit' -> ^2.12.0 (redux stays ^5.0.1 — already latest), and packages/ignite-element/src/examples/mobx/package.json 'mobx' -> ^6.16.1. Keep the peer-dependency floors conservative (do NOT raise '>=2.3.0' / '>=6.13.5' / '>=5.0.1'). Run 'pnpm install' to update the lockfile. Verify: '.fas/scripts/verify.sh --full' green (Redux/Mobx adapter source, types, and tests still pass on the new versions), and an in-place example install (npm install in examples/redux and examples/mobx) typechecks clean. ignite-element has no direct redux/mobx devDependency (its tests resolve them via the adapters' hoisted deps), so no change there beyond the peer block. Affected files: packages/ignite-adapters/package.json, packages/ignite-element/src/examples/redux/package.json, packages/ignite-element/src/examples/mobx/package.json, pnpm-lock.yaml.

## Acceptance criteria
- The new functionality works as described.
- Existing behavior is not broken.
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
- Scope unknown.

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
