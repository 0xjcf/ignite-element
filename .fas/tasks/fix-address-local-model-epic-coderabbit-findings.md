# fix: address local-model epic CodeRabbit findings

## Source
Created with `fas create-task` on 2026-07-06.

## Problem
fix: address local-model epic CodeRabbit findings

## Acceptance criteria
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- .github/workflows/ci.yml
- .gitignore
- biome.json
- package.json
- examples/agents/smart-home/src/actor-web-home.ts
- examples/agents/smart-home/src/anthropic.ts
- examples/agents/smart-home/src/mlx.ts
- examples/agents/smart-home/src/mock.ts
- examples/agents/smart-home/src/server-mlx.ts
- examples/agents/smart-home/src/model.ts
- examples/agents/smart-home/src/agentLoop.ts
- examples/agents/smart-home/src/agentLoop.test.ts
- examples/agents/smart-home/src/cli.ts
- examples/agents/smart-home/src/home.ts
- examples/agents/smart-home/src/lifecycle.ts
- examples/agents/smart-home/src/shared/home.ts
- examples/agents/smart-home/src/server.test.ts
- examples/agents/smart-home/src/server.ts
- examples/agents/smart-home/README.md
- examples/agents/smart-home/pnpm-lock.yaml
- examples/agents/smart-home/tsconfig.json
- packages/ignite-element/src/tools/openai/index.ts
- packages/ignite-element/src/tests/tools.openai.test.ts
- scripts/typecheck-examples.mjs
- scripts/__tests__/typecheck-examples.test.mjs
- docs/ignite-tools.md
- docs/v3-stable-roadmap.md
- .fas/queue/tasks.json
- .changeset/ignitetools-openai-dialect.md
- .fas-config.json
- examples/adapters/redux/package.json
- examples/adapters/redux/pnpm-lock.yaml
- examples/adapters/xstate/package.json
- examples/adapters/xstate/pnpm-lock.yaml
- examples/apps/dashboard-with-shared-state/package.json
- examples/apps/dashboard-with-shared-state/pnpm-lock.yaml
- examples/apps/form-with-validation/package.json
- examples/apps/form-with-validation/pnpm-lock.yaml
- examples/apps/nested-child-router/package.json
- examples/apps/nested-child-router/pnpm-lock.yaml
- examples/apps/spa-router/package.json
- examples/apps/spa-router/pnpm-lock.yaml
- examples/frameworks/react/package.json
- examples/frameworks/react/pnpm-lock.yaml
- examples/frameworks/svelte/package.json
- examples/frameworks/svelte/pnpm-lock.yaml
- examples/frameworks/vue/package.json
- examples/frameworks/vue/pnpm-lock.yaml

## Scope Amendments
- Added `examples/agents/smart-home/src/home.ts` after the second CodeRabbit
  review identified that the local runtime session close path was a no-op and
  needed ownership of a stoppable XState actor.
- Added `examples/agents/smart-home/src/server.test.ts` to cover the bridge
  server close behavior while an OpenAI-compatible agent run is in flight.
- Added the CI, example typecheck, OpenAI dialect, smart-home MLX/mock/server,
  package metadata, and Biome ignore paths after CodeRabbit follow-up fixes and
  the stale remote `examples-typecheck` CI failure showed the review-fix scope
  needed to include the full local-model closeout surface.
- Added `examples/agents/smart-home/src/shared/home.ts` after the latest
  CodeRabbit review identified that shared home helpers and constants needed to
  be exported from the self-contained shared module surface.
- Added `examples/agents/smart-home/src/cli.ts` after CodeRabbit flagged the
  duplicated smart-home CLI runtime selection and print/close coordination
  across Anthropic, mock, and MLX entrypoints.
- Added `examples/agents/smart-home/src/lifecycle.ts` after CodeRabbit flagged
  duplicated bridge startup/shutdown timeout logic between the default and MLX
  server entrypoints.

- Type: scope-refresh-promotion
- Added at: 2026-07-06
- Trigger: dirty-low-confidence-scope
- Reason: Promoted dirty low-confidence or dependency-reachable task-packet path(s) into affected scope.
- Added paths: examples/agents/smart-home/src/agentLoop.test.ts, examples/agents/smart-home/src/home.ts, examples/agents/smart-home/src/server.test.ts
- Evidence source: task-packet dirty scope promotion
- Evidence: task-packet dirty scope promotion | .fas/state/task-packet.json | Promoted dirty path(s): examples/agents/smart-home/src/agentLoop.test.ts, examples/agents/smart-home/src/home.ts, examples/agents/smart-home/src/server.test.ts
- Accuracy signal: Path was dirty in git status and present in task-packet low-confidence/dependency-reachable scope.

- Type: scope-refresh-promotion
- Added at: 2026-07-07
- Trigger: dirty-low-confidence-scope
- Reason: Promoted dirty low-confidence or dependency-reachable task-packet path(s) into affected scope.
- Added paths: examples/agents/smart-home/src/anthropic.ts
- Evidence source: task-packet dirty scope promotion
- Evidence: task-packet dirty scope promotion | .fas/state/task-packet.json | Promoted dirty path(s): examples/agents/smart-home/src/anthropic.ts
- Accuracy signal: Path was dirty in git status and present in task-packet low-confidence/dependency-reachable scope.

- Type: scope-refresh-promotion
- Added at: 2026-07-07
- Trigger: dirty-low-confidence-scope
- Reason: Promoted dirty low-confidence or dependency-reachable task-packet path(s) into affected scope.
- Added paths: examples/agents/smart-home/src/anthropic.ts, examples/agents/smart-home/src/agentLoop.test.ts
- Evidence source: task-packet dirty scope promotion
- Evidence: task-packet dirty scope promotion | .fas/state/task-packet.json | Promoted dirty path(s): examples/agents/smart-home/src/anthropic.ts, examples/agents/smart-home/src/agentLoop.test.ts
- Accuracy signal: Path was dirty in git status and present in task-packet low-confidence/dependency-reachable scope.

- Type: scope-refresh-promotion
- Added at: 2026-07-07
- Trigger: dirty-low-confidence-scope
- Reason: Promoted dirty low-confidence or dependency-reachable task-packet path(s) into affected scope.
- Added paths: examples/agents/smart-home/src/anthropic.ts, examples/agents/smart-home/src/mlx.ts, examples/agents/smart-home/src/agentLoop.test.ts
- Evidence source: task-packet dirty scope promotion
- Evidence: task-packet dirty scope promotion | .fas/state/task-packet.json | Promoted dirty path(s): examples/agents/smart-home/src/anthropic.ts, examples/agents/smart-home/src/mlx.ts, examples/agents/smart-home/src/agentLoop.test.ts
- Accuracy signal: Path was dirty in git status and present in task-packet low-confidence/dependency-reachable scope.

- Type: scope-refresh-promotion
- Added at: 2026-07-07
- Trigger: dirty-low-confidence-scope
- Reason: Promoted dirty low-confidence or dependency-reachable task-packet path(s) into affected scope.
- Added paths: examples/agents/smart-home/src/agentLoop.test.ts
- Evidence source: task-packet dirty scope promotion
- Evidence: task-packet dirty scope promotion | .fas/state/task-packet.json | Promoted dirty path(s): examples/agents/smart-home/src/agentLoop.test.ts
- Accuracy signal: Path was dirty in git status and present in task-packet low-confidence/dependency-reachable scope.

- Type: review-follow-up
- Added at: 2026-07-07
- Trigger: coderabbit-release-metadata-finding
- Reason: Added the OpenAI dialect changeset after CodeRabbit identified malformed Changesets frontmatter that would break release metadata parsing.
- Added paths: .changeset/ignitetools-openai-dialect.md
- Evidence source: CodeRabbit committed review
- Evidence: CodeRabbit committed review | .changeset/ignitetools-openai-dialect.md | Missing opening frontmatter delimiter before the ignite-element minor entry.
- Accuracy signal: pnpm changeset status --since beta parses the corrected changeset successfully.

- Type: review-fix-scope
- Added at: 2026-07-07
- Trigger: CodeRabbit FAS typecheck hook finding
- Reason: Added .fas-config.json after CodeRabbit identified that the FAS typecheck hook should align with the packages-only CI build lane while full verification keeps example typecheck coverage through its explicit example lane.
- Added paths: .fas-config.json
- Evidence source: CodeRabbit committed review
- Evidence: CodeRabbit committed review | .fas-config.json | typecheckCommand now points to npm run typecheck:packages; package.json keeps typecheck:full and typecheck:examples for full/local and CI coverage.
- Accuracy signal: fas validate-task typecheck stage passed in 4s with the packages-only hook, matching the CI build job.

- Type: review-fix-scope
- Added at: 2026-07-07
- Trigger: CodeRabbit example compiler finding
- Reason: Added example package manifests and lockfiles after CodeRabbit identified that the example runtime typecheck lane should use each self-contained example package's local TypeScript compiler instead of the root package compiler.
- Added paths: examples/adapters/redux/package.json, examples/adapters/redux/pnpm-lock.yaml, examples/adapters/xstate/package.json, examples/adapters/xstate/pnpm-lock.yaml, examples/apps/dashboard-with-shared-state/package.json, examples/apps/dashboard-with-shared-state/pnpm-lock.yaml, examples/apps/form-with-validation/package.json, examples/apps/form-with-validation/pnpm-lock.yaml, examples/apps/nested-child-router/package.json, examples/apps/nested-child-router/pnpm-lock.yaml, examples/apps/spa-router/package.json, examples/apps/spa-router/pnpm-lock.yaml, examples/frameworks/react/package.json, examples/frameworks/react/pnpm-lock.yaml, examples/frameworks/svelte/package.json, examples/frameworks/svelte/pnpm-lock.yaml, examples/frameworks/vue/package.json, examples/frameworks/vue/pnpm-lock.yaml
- Evidence source: CodeRabbit committed review
- Evidence: CodeRabbit committed review | scripts/typecheck-examples.mjs | Review requested example-local tsc resolution or an explicit shared compiler policy; this task chose example-local compilers and added TypeScript dev dependencies to examples that did not declare one.
- Accuracy signal: npm run typecheck:examples passed for all 11 examples using local TypeScript compiler paths.

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
