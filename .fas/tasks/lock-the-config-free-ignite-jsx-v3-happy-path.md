# Lock the config-free Ignite JSX v3 happy path

## Source
Created with `fas create-task` on 2026-05-28.

## Problem
Make the v3 first-read path config-free and style-tag friendly. The default docs and examples should not expose ignite.config.ts, renderer selection, config loader, or plugin wiring for ordinary Ignite JSX component authoring. Imported CSS or TS style strings should be rendered through ordinary style tags when useful, while Lit/config/plugin paths stay documented as advanced or compatibility features.

## Acceptance criteria
- First-read docs and examples show igniteCore adapter entrypoints, Ignite JSX tsconfig, and ordinary <style>{styles}</style> usage without ignite.config.ts.
- Legacy or advanced config-loader/plugin/Lit content is clearly separated from the v3 happy path.
- Export and docs snapshots do not promote unstable or internal styling/config APIs as default public API.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-element/README.md
- docs/site/src/content/docs/index.mdx
- docs/site/src/content/docs/guides/agent-runtime-v3.mdx
- docs/site/src/content/docs/api/define-ignite-config.mdx
- packages/ignite-element/src/examples/xstate

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
