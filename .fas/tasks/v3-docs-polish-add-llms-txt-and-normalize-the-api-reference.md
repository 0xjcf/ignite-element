# v3 docs polish: add llms.txt and normalize the API reference to a contract-first template

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
- docs/site/src/content/docs/api/ignite-core.mdx (normalize: `**Params**` → `## Parameters` heading)
- docs/site/src/content/docs/api/advanced-config.mdx (normalize: add the consistent `## Related` footer)
- docs/site/src/content/docs/api/compatibility.mdx (normalize: add the consistent `## Related` footer)

## Scope Amendments
- This task ships only the **doc-only half** (contract-first API-template normalization). The `starlight-llms-txt` plugin add is deliberately NOT in this commit/batch: it requires a `pnpm install` the sandbox can't run, and adding the dep to `astro.config.mjs` + `package.json` without the installed module would break `docs:build` and the one shared full verify for the whole batch. So `astro.config.mjs` and `package.json` were intentionally left unchanged. See "Operator action required" below.
- Normalization scope: the api/* pages (`headless-runtime`, `command-metadata`, `testing-dsl`, `ignite-core`, `advanced-config`, `compatibility`) already followed a contract-first shape (intro → signature → params/methods → returns → example). The remaining inconsistencies were `ignite-core`'s bold `**Params**` (promoted to a `## Parameters` heading) and the missing `## Related` footer on `advanced-config` and `compatibility` (added). External anchors (`#getschema`, `#recordname`, `#stories`) are preserved.

## Operator action required (llms.txt plugin)
The agent layer's `/llms.txt` + `/llms-full.txt` still needs the plugin, which requires a local install the sandbox cannot perform:

1. From `docs/site`, install the dev dependency: `pnpm add -D starlight-llms-txt` (this updates `docs/site/package.json` + the workspace lockfile).
2. Wire it in `docs/site/astro.config.mjs` — import `starlightLlmsTxt` and add it to the Starlight `plugins: [...]` array (alongside `starlightVersions`).
3. Rebuild (`pnpm --filter docs-site build`) and confirm `/ignite-element/llms.txt` and `/ignite-element/llms-full.txt` are emitted into `dist/`.
4. Commit the lockfile + `package.json` + `astro.config.mjs` together as a follow-up (it is safe to land outside the shared docs batch since it carries its own install).

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
