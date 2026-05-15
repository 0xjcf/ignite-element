# Repair Actor-Web adapter review evidence and artifact links

## Goal

Repair the active `Ignite Element Actor-Web first-class adapter` review handoff so the review artifacts point to existing files and the task scope evidence is explicit.

## Evidence

- `.fas/state/current-task.json` points `artifactLinks.review` at `.fas/state/boundary-review-findings.md`, but the current review artifact is `.fas/state/review-summary.md`.
- `.fas/state/review-summary.md` reports an unresolved task scope and suppresses committed evidence because no active-task base SHA was recorded.
- `git merge-base HEAD main` resolves to `94a78b90cdb88551adea2b7fc5bfe5009b4548c2` in this checkout.

## Scope

- Update FAS state and tracker artifacts only.
- Do not change product source code.
- Preserve the latest full verification receipt instead of rerunning heavy verification unless the repair invalidates it.

## Affected Files

- `.fas/TASKS.md`
- `.fas/state/current-task.json`
- `.fas/state/review-summary.md`

## Acceptance Criteria

- `.fas/state/current-task.json` review artifact link points to `.fas/state/review-summary.md`.
- `.fas/TASKS.md` uses the same review artifact for the active Actor-Web adapter task.
- `.fas/state/review-summary.md` names the branch, base SHA, committed evidence source, and review-ready caveats.
- Focused validation confirms edited JSON and markdown files are syntactically usable.

## Recommended Mode

4-agent

## Recommended Phase

closeout
