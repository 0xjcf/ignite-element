# Add a docs version/compat matrix and fix the orphaned migrat

## Source
Created with `fas create-task` on 2026-06-04.

## Problem
The v3 docs state Node 22+ but give no supported versions for the optional peer dependencies (xstate, redux/@reduxjs/toolkit, mobx, lit-html) or the required TypeScript version — which matters for a beta. Separately, migration/effects-events.mdx exists and is linked inline but is not in the sidebar nav (orphaned). Source the version requirements from each package's peerDependencies so the matrix stays truthful.

## Acceptance criteria
- A compatibility section or page lists the required/supported versions of each optional peer (xstate, redux/@reduxjs/toolkit, mobx, lit-html) plus TypeScript and Node, sourced from the packages' peerDependencies
- migration/effects-events.mdx is added to the Migration sidebar group in astro.config.mjs (or intentionally merged/removed if redundant, with rationale)
- Only current v3 docs touched
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- docs/site/src/content/docs/getting-started/installation.mdx
- docs/site/astro.config.mjs

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
