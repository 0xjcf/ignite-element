# Add a docs theme contrast guardrail to catch un-themed contr

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
- .github/workflows/ci.yml
- .github/workflows/docs-deploy.yml

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
