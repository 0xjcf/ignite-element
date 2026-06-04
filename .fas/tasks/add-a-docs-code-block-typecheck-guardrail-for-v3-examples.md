# Add a docs code-block typecheck guardrail for v3 examples

## Source
Created with `fas create-task` on 2026-06-04.

## Problem
MDX code blocks in the v3 docs are not typechecked. Example projects under packages/ignite-element/src/examples are typechecked, but doc code fences are not — which is how guides/agent-runtime-v3.mdx shipped an example that references a bare snapshot variable not in scope (line 32). Add a guardrail (sibling to the contrast + geometry guardrails) that extracts ts/tsx/typescript code fences from the CURRENT v3 docs (docs/site/src/content/docs, excluding the frozen 2.x archive) and typechecks them against the real published package types (ignite-element and its subpaths plus @ignite-element/core, /adapters, /renderer). This automates doc accuracy instead of policing it by hand and was the systemic root cause behind the doc-accuracy audit.

## Acceptance criteria
- A script extracts fenced ts/tsx/typescript code blocks from docs/site/src/content/docs/**/*.mdx for the current v3 docs only (2.x archive excluded) and typechecks them against the real package types
- Illustrative or intentionally-partial snippets can opt out via a documented marker (code-fence meta or a leading comment); everything else must typecheck
- The check exits non-zero on a type error and reports file, line, and the TypeScript message
- Wired into CI on PRs touching docs/site (extend or sit beside the docs-contrast workflow); a package.json script runs it locally
- Running it on the current docs surfaces the known agent-runtime-v3 error and any others; list them in the task output (fixing them is the separate accuracy-pass task)
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- docs/site/scripts/check-doc-examples.mjs
- docs/site/package.json
- .github/workflows/docs-contrast.yml

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
