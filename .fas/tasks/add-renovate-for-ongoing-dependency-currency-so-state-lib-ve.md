# Add Renovate for ongoing dependency currency so state-lib ve

## Source
Created with `fas create-task` on 2026-06-17.

## Problem
Add Renovate for ongoing dependency currency so state-lib versions stop drifting (would have caught the xstate 5.25/5.30 split). Add a renovate.json (or .github/renovate.json) configured for this pnpm-workspace monorepo: (1) group the state libraries (xstate, @reduxjs/toolkit, redux, mobx) into a single grouped PR so adapter+example bumps land together; (2) limit automated bumps to devDependencies and the example packages — never auto-bump the published packages' own versions or peer-dependency floors (those are deliberate, changeset-gated decisions); (3) keep examples pinned where determinism matters (e.g. xstate examples are pinned exact to avoid the in-place-install typecheck skew); (4) a sane schedule + PR concurrency limit; (5) respect the changesets release flow (do not touch .changeset or package versions). Evaluate Dependabot as the simpler GitHub-native alternative, but Renovate is preferred for its monorepo grouping. Document the policy briefly. Affected files: renovate.json (new), and a short note in the contributing/release docs.

## Automation admission
- Expected operator value: Improves operator leverage around "Add Renovate for ongoing dependency currency so state-lib versions stop drifting (would have caught the xstate 5.25/5.30 split). Add a renovate.json (or .github/renovate.json) configured for this pnpm-workspace monorepo: (1) group the state libraries (xstate, @reduxjs/toolkit, redux, mobx) into a single grouped PR so adapter+example bumps land together; (2) limit automated bumps to devDependencies and the example packages — never auto-bump the published packages' own versions or peer-dependency floors (those are deliberate, changeset-gated decisions); (3) keep examples pinned where determinism matters (e.g. xstate examples are pinned exact to avoid the in-place-install typecheck skew); (4) a sane schedule + PR concurrency limit; (5) respect the changesets release flow (do not touch .changeset or package versions). Evaluate Dependabot as the simpler GitHub-native alternative, but Renovate is preferred for its monorepo grouping. Document the policy briefly. Affected files: renovate.json (new), and a short note in the contributing/release docs." by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

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
