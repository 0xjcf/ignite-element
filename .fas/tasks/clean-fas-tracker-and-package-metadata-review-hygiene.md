# clean FAS tracker and package metadata review hygiene

## Source

Created with `fas create-task` on 2026-05-22.

## Problem

Group remaining CodeRabbit minor metadata and tracker findings after higher-risk code/docs fixes and the v3 public API boundary cleanup: verify the queued/completed tracker projection stays aligned with live queue state, remove duplicate generated acceptance criteria in completed task briefs, decide whether truncated completed-task brief filenames should be renamed or documented as FAS slug behavior, verify actor-web README/export docs are already covered by the v3 boundary work, ensure mobx devDependency metadata matches local adapter build needs, and explain or adjust the ignite-core package version convention. Source: CodeRabbit FAS, adapters, and core domain reviews run against origin/main after commit 3a082b3; refreshed after the v3 API boundary task on 2026-05-27.

## Acceptance criteria

- Tracker queue projection matches live .fas/queue/tasks.json and contains no done task under Queued Tasks.
- Duplicate acceptance criteria are removed from affected briefs without changing task intent.
- Any completed-task brief filename rename updates all references, or the task records why FAS-truncated slugs are intentional and left unchanged.
- Package README and package.json metadata match exported entrypoints and local build requirements; actor-web README/export docs are verified rather than rewritten if the v3 boundary work already covers them.
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
- pnpm-lock.yaml

## Scope Amendments

- 2026-05-27: v3 public API boundary work already documented the stable actor-web entrypoint and package boundary. Treat actor-web README/export docs as a verification item, not expected new writing, unless planning finds a current mismatch.

- Type: dependency-lockfile
- Added at: 2026-05-27
- Trigger: Adding mobx as an ignite-adapters local devDependency requires the workspace lockfile importer to stay frozen-install safe.
- Reason: pnpm-lock.yaml is necessary package metadata fallout from the explicit package.json dependency hygiene change.
- Added paths: pnpm-lock.yaml
- Evidence source: pnpm install --lockfile-only
- Evidence: pnpm install --lockfile-only | pnpm-lock.yaml | Importer moved mobx from auto-installed peer dependency surface into ignite-adapters devDependencies.
- Accuracy signal: lockfile update is mechanically required for frozen pnpm installs
- Follow-up needed: Ignore unrelated platform metadata churn unless future pnpm versions keep rewriting it.

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
