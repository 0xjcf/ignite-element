# repair build and module configuration blockers from CodeRabb

## Source

Created with `fas create-task` on 2026-05-22.

## Problem

Group CodeRabbit build/config findings that can invalidate examples or typechecking: replace ESM-invalid __dirname usage in redux example Vite config, repair ignite-element tsconfig.typecheck path mappings against the actual monorepo layout, remove or make mode-aware the hard-coded production NODE_ENV define, and assess the package dependency upgrade recommendation for Vite, TypeScript, and vite-plugin-dts before changing lockfiles. Source: CodeRabbit domain reviews run against origin/main after commit 3a082b3.

## Acceptance criteria

- Redux example Vite config works under ESM without __dirname.
- ignite-element typecheck mappings resolve to real package or source paths and pnpm run typecheck passes.
- Build config no longer forces development builds into production NODE_ENV.
- Dependency upgrade recommendation is either safely implemented with lockfile verification or explicitly documented as deferred with current-version rationale.
- Run pnpm run lint, pnpm run typecheck, pnpm test, and fas verify --full.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution

- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered

- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files

- packages/ignite-element/src/examples/redux/vite.config.ts
- packages/ignite-element/tsconfig.typecheck.json
- packages/ignite-element/vite.config.ts
- packages/ignite-core/package.json
- pnpm-lock.yaml

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
