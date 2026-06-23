# ci: add an example-typecheck job (per-example self-contained install + tsc) gated on PRs into beta

## Source
Created with `fas create-task` on 2026-06-23.

## Problem
After PR #65 relocated examples to top-level examples/ (self-contained, NOT pnpm-workspace members), they were dropped from the library's gated typecheck — so nothing in CI now catches example regressions (CodeRabbit flagged this on #65). Add a CI job that replicates the verified-local flow. Per example: cd examples/<kind>/<name> && pnpm install --ignore-workspace --no-link-workspace-packages, then run the LIBRARY tsc against the example tsconfig: packages/ignite-element/node_modules/.bin/tsc --project examples/<kind>/<name>/tsconfig.json (the example tsconfigs extend the library tsconfig.typecheck.json and map ignite-element/@ignite-element/* to local package source, so a root pnpm install is needed first for the tsc binary + ignite-* sources; the example install provides vue/svelte/xstate/lit-html/etc.). Cover all 8: adapters/{xstate,redux,mobx}, apps/{spa-router,form-with-validation}, frameworks/{react,vue,svelte}. Loop over the examples, collect ALL failures, and fail the job if any example breaks (do not fail-fast). Add as a NEW job in .github/workflows/ci.yml alongside build, inheriting the existing PR-into-beta triggers; must NOT affect the release job (main-push-only). Match the existing build job's setup steps (pnpm/action-setup@v4 run_install:false, actions/setup-node@v4 with cache: pnpm, node 22). All 8 examples currently typecheck locally, so the job must be green on the current tree.

## Acceptance criteria
- A new CI job typechecks all 8 top-level examples on PRs into beta
- Each example is installed self-contained (pnpm install --ignore-workspace --no-link-workspace-packages) before tsc
- The job collects all failures and fails if ANY example fails typecheck (no fail-fast)
- The release job remains unaffected (main-push-only)
- The job is green on the current tree (all 8 examples pass)
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
- .github/workflows/ci.yml

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
