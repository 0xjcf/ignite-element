# igniteTools PR 1: hexagonal core + ToolDialect port + fake dialect (ignite-element/tools entrypoint; TDD; no provider SDK)

## Source
Created with `fas create-task` on 2026-06-22.

## Problem
igniteTools PR 1: hexagonal core + ToolDialect port + fake dialect (ignite-element/tools entrypoint; TDD; no provider SDK)

## Acceptance criteria
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Establish the intended approach at a design level before editing code.

## Alternatives considered
- None recorded yet.

## Affected files
- packages/ignite-element/src/tools/index.ts (NEW — `ignite-element/tools` entrypoint re-exports)
- packages/ignite-element/src/tools/igniteTools.ts (NEW — factory + invoke shell)
- packages/ignite-element/src/tools/core.ts (NEW — pure buildManifest/resolveCall + validator)
- packages/ignite-element/src/tools/types.ts (NEW — neutral/port/error types + IgniteToolsComponent)
- packages/ignite-element/src/tools/result.ts (NEW — Result<T,E> errors-as-values primitive)
- packages/ignite-element/src/tests/tools.test.ts (NEW — behavior tests vs fake component + fake dialect)
- packages/ignite-element/src/tests/types/tools.types.test.ts (NEW — typed observation/manifest type tests)
- packages/ignite-element/vite.config.ts (add `tools` build entry)
- packages/ignite-element/package.json (add `./tools` export + typesVersions)
- packages/ignite-element/scripts/verify-exports.mjs (allowlist `./tools` entrypoint)
- .changeset/ignite-tools-core.md (additive minor; ignite-element)

## Scope Amendments
- None.

## Implementation plan
- Build the implementation plan during task planning.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Identify regression, rollout, or coordination risks during planning.

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
