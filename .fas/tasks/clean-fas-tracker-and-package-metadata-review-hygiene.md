# clean FAS tracker and package metadata review hygiene

## Source

Created with `fas create-task` on 2026-05-22.

## Problem

Group CodeRabbit minor metadata and tracker findings after higher-risk code/docs fixes: verify the queued/completed tracker projection stays aligned with live queue state, remove duplicate generated acceptance criteria in completed task briefs, decide whether truncated completed-task brief filenames should be renamed or documented as FAS slug behavior, add missing ignite-adapters/actor-web README export docs, ensure mobx devDependency metadata matches local adapter build needs, and explain or adjust the new ignite-core package version convention. Source: CodeRabbit FAS, adapters, and core domain reviews run against origin/main after commit 3a082b3.

## Acceptance criteria

- Tracker queue projection matches live .fas/queue/tasks.json and contains no done task under Queued Tasks.
- Duplicate acceptance criteria are removed from affected briefs without changing task intent.
- Any completed-task brief filename rename updates all references, or the task records why FAS-truncated slugs are intentional and left unchanged.
- Package README and package.json metadata match exported entrypoints and local build requirements.
- Run git diff --check, pnpm run lint, pnpm run typecheck, pnpm test, and fas verify --full.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution

- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered

- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files

- .fas/TASKS.md
- .fas/tasks/align-ignite-element-package-boundaries-with-adr-003.md
- .fas/tasks/shared-architecture-adr-and-model-alignment.md
- .fas/tasks/add-command-metadata-helpers-for-enriched-agent-runtime-sche.md
- .fas/tasks/add-story-recorder-api-with-behavior-traces-and-lifecycle-ev.md
- packages/ignite-adapters/README.md
- packages/ignite-adapters/package.json
- packages/ignite-core/package.json

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
