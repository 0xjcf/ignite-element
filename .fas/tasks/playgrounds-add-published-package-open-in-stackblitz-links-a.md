# playgrounds: add published-package Open in StackBlitz links after the v3 stable tag

## Source
Created with `fas create-task` on 2026-07-07.

## Problem
Created from spike capture direct-1783460401998 on 2026-07-07T21:44:53Z.

Gap identified:
- playgrounds: add published-package Open in StackBlitz links after the v3 stable tag

The current examples are intentionally self-contained and source-aliased to the
local monorepo for dogfooding. That is good for repository validation but not a
portable public playground shape. After v3 stable flips `ignite-element` to the
`latest` dist-tag, add external playground links that depend on the published
package instead of importing monorepo source.

## Acceptance criteria
- Add external "Open in StackBlitz" links for at least one v3 playground, preferably `spa-router` or a smaller router slice, using a standalone project that depends on the published `ignite-element` package.
- Do not add iframe/WebContainer embeds to the docs; keep docs-native live demos in-page and playgrounds as external links.
- Avoid importing `examples/*` GitHub subfolders directly when they rely on Vite source aliases into `../../../packages`.
- Update stale StackBlitz links that would point readers at old or non-v3 examples.
- If CodeSandbox/Sandpack is included, it must run the same published-package project shape; otherwise document why StackBlitz is the only supported playground path for now.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Build or link a generated/public StackBlitz project that includes its own
  package.json, source files, and Vite config with `ignite-element` from npm.
- Keep the docs link-only. Do not reintroduce embedded WebContainer iframes.
- Prefer one reliable playground over broad coverage.

## Alternatives considered
- GitHub subfolder import: rejected for current examples because local Vite
  aliases point outside the imported folder.
- Docs iframe embed: rejected because WebContainer embedding has browser/header
  constraints and this repo already replaced the homepage embed with a
  docs-native demo after an isolation-header failure.

## Affected files
- docs/site/src/content/docs/index.mdx
- docs/site/src/content/docs/guides/routing.mdx or related example docs
- examples/apps/spa-router/** only if creating a standalone exportable playground fixture is approved

## Scope Amendments
- None.

## Implementation plan
- Confirm the v3 stable release has flipped `ignite-element` latest before using
  unqualified package versions.
- Choose the first playground target and convert it to a standalone
  published-package shape.
- Add or update docs links as external "Open in StackBlitz" actions.
- Smoke-check the playground manually and record evidence in the task closeout.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.
- Run `pnpm run docs:build`.
- Smoke-check the external playground link after it exists.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Running this before stable would require `ignite-element@beta` links that must
  be changed again at release. Keep this task after the stable tag flip unless
  the owner explicitly wants beta playground links.

## Dependencies
- Depends on stable v3 publish / npm `latest` tag flip.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
