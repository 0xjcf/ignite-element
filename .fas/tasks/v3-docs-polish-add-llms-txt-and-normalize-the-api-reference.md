# v3 docs polish: add llms.txt and normalize the API reference

## Source
Created with `fas create-task` on 2026-06-04.

## Problem
Phase 4, after restructure (needs the final page set). (1) Add the starlight-llms-txt plugin so the site serves /llms.txt (curated index) and /llms-full.txt (concatenated content) for agents; wire it in astro.config.mjs. NOTE: the devDependency add needs a pnpm install the operator runs locally (sandbox can't) — flag it for them. (2) Normalize api/* pages (igniteCore, headless-runtime, command-metadata, testing-dsl, advanced-config, compatibility) to ONE predictable contract-first template: one-sentence intro -> signature -> params -> return shape -> one runnable example, same heading order on every page, stable anchors. This is the agent-readability layer. Only current v3 docs; examples pass the guardrail. Spike report: .fas/state/spikes/v3-docs-ia-audit.md

## Acceptance criteria
- The site serves /llms.txt and /llms-full.txt (via starlight-llms-txt) covering the current v3 docs; the lockfile/devDependency change is flagged for the operator to pnpm install
- All api/* reference pages follow one contract-first template (intro -> signature -> params -> returns -> example) with consistent heading order and stable anchors
- Doc examples pass the guardrail; docs:build green
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- docs/site/astro.config.mjs
- docs/site/package.json

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
