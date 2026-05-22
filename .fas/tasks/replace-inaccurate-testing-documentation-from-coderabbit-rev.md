# replace inaccurate testing documentation from CodeRabbit rev

## Source

Created with `fas create-task` on 2026-05-22.

## Problem

Group CodeRabbit docs findings that mislead users with nonexistent helpers or outdated examples: replace fake ignite-element test helper examples in docs/api and docs-site testing guide with real Vitest/JSDOM or headless igniteCore patterns, fix the effects-events migration before example so it demonstrates emit-in-commands as the old pattern, correct the ignite-query data-over-time subtitle, and ensure package/docs README links point to files that actually exist. Source: CodeRabbit docs domain review run against origin/main after commit 3a082b3.

## Acceptance criteria

- No docs example imports non-existent test helpers from ignite-element.
- Testing docs demonstrate current supported APIs and renderer imports accurately.
- Migration guide before/after examples clearly distinguish deprecated emit-in-commands from effects emission.
- All changed markdown/MDX links and referenced paths exist or are intentionally external.
- Run pnpm run lint, pnpm run typecheck, pnpm test, docs build if touched docs-site content requires it, and fas verify --full.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution

- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered

- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files

- docs/api/README.md
- docs/site/src/content/docs/guides/testing.mdx
- docs/migrations/v2.2.3-effects-events.md
- docs/ignite-query.md
- packages/ignite-element/README.md
- docs/site/src/content/docs/migration/

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
