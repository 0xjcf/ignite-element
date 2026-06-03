# Add a docs theme contrast guardrail to catch un-themed controls

## Source
Created with `fas create-task` on 2026-06-02.

## Problem
New chrome/controls in the Starlight docs site can ship invisible in one theme (as the version picker did in dark mode) with no automated catch. Add a lightweight guardrail that computes contrast ratios for key chrome and content selectors in both light and dark themes and fails when a UI element is below threshold, wired into CI so it runs on PRs touching docs/site. This codifies the manual contrast audit done during the version-picker fix.

## Acceptance criteria
- A script renders the built docs site and computes contrast ratios for key chrome (version/theme selects, search, sidebar, TOC) and content (asides, code, links) selectors in both themes
- The check fails when any UI/text element falls below threshold (UI < 3:1, body text < 4.5:1)
- The check is wired into CI (ci.yml or docs-deploy.yml) for PRs that touch docs/site, and documented for local runs
- It reuses or replaces the ad-hoc audit logic from the version-picker fix
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- docs/site/package.json
- docs/site/scripts/check-contrast.mjs
- docs/site/README.md
- .github/workflows/docs-contrast.yml

<!-- ci.yml/docs-deploy.yml were the original hints but were intentionally NOT
modified; a dedicated path-filtered workflow at .github/workflows/ is the
correct PR-scoped wiring. See Scope Amendments. -->

## Scope Amendments
- Type: ci-wiring-choice
- Added at: 2026-06-03
- Trigger: Brief named ci.yml/docs-deploy.yml, but neither cleanly supports 'PRs that touch docs/site'
- Reason: ci.yml runs on ALL PRs with no path scope (would run the heavy headless-browser step on every non-docs PR); docs-deploy.yml only runs on push to main (no PR coverage). Created a dedicated path-filtered workflow .github/workflows/docs-contrast.yml (on.pull_request.paths: docs/site/**) instead — idiomatic and correctly scoped. Non-blocking Confusion-Protocol choice.
- Added paths: docs/site/scripts/check-contrast.mjs, docs/site/README.md, .github/workflows/docs-contrast.yml
- Follow-up needed: Requires 'pnpm install' to sync pnpm-lock.yaml for the new @playwright/test docs-site devDep (sandbox cannot run pnpm install); CI's 'pnpm install --frozen-lockfile' will fail until the lockfile is committed.

## Implementation plan
- Convert the supplied context into a scoped implementation plan before editing.
- Refresh affected-file scope before implementation if the generated hints are incomplete.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Validate generated scope, acceptance criteria, and verification evidence before closeout to avoid workflow drift.

## Dependencies
- Runs AFTER the design-system and UX-flow passes so it codifies their finalized contrast/visual expectations
- Builds on the manual contrast audit from the version-picker fix (commit f2f61cb)

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
