# Normalize remaining self-contained example install commands to pnpm current workspace-link flag

## Source
Created with `fas create-task` on 2026-07-07.

## Problem
PR #90 CodeRabbit flagged stale --no-link-workspace-packages usage in the new screencast. The PR fixed its touched file, but existing docs/scripts still contain the old flag. Replace current repo-owned example install snippets and orchestration commands with pnpm's supported --link-workspace-packages=false form where appropriate, without editing historical FAS task briefs except if a current brief requires it.

## Acceptance criteria
- Current docs and runtime scripts no longer recommend or execute --no-link-workspace-packages for self-contained example installs.
- scripts/test-examples.mjs and scripts/typecheck-examples.mjs still install top-level examples self-contained and pass their existing coverage.
- .fas/scripts/verify.sh --full passes after the cleanup.
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
- scripts/test-examples.mjs
- scripts/typecheck-examples.mjs
- docs/examples/README.md
- examples/apps/dashboard-with-shared-state/README.md
- examples/apps/form-with-validation/README.md
- examples/frameworks/react/README.md
- examples/frameworks/vue/README.md
- examples/frameworks/svelte/README.md
- packages/ignite-element/package.json

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
