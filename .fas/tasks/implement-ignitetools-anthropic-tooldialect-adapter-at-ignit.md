# implement igniteTools anthropic ToolDialect adapter at ignite-element/tools/anthropic with the Option D port refinement (parseToolCalls gains a manifest param) + shared scalar helpers in tools/scalar.ts + N1 method naming (toTools/readCalls/toResult, invoke to run)

## Source
Created with `fas create-task` on 2026-06-24.

## Problem
implement igniteTools anthropic ToolDialect adapter at ignite-element/tools/anthropic with the Option D port refinement (parseToolCalls gains a manifest param) + shared scalar helpers in tools/scalar.ts + N1 method naming (toTools/readCalls/toResult, invoke to run)

## Acceptance criteria
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Establish the intended approach at a design level before editing code.

## Alternatives considered
- None recorded yet.

## Affected files
Design lock (final): see memory ignitetools-pr2-design-locked — Option D port refinement (parseToolCalls gains a manifest param), shared scalar helpers in the tools package, bare-noun naming (tools, toolCalls, toolResult, run), act+ack observation contract (observe channel deferred to the dogfood). Fold packaging into one beta PR.

Port + helpers + adapter (source):
- packages/ignite-element/src/tools/types.ts
- packages/ignite-element/src/tools/igniteTools.ts
- packages/ignite-element/src/tools/scalar.ts
- packages/ignite-element/src/tools/anthropic/index.ts
- packages/ignite-element/src/tools/index.ts
Entrypoint wiring (mirrors #64 /tools):
- packages/ignite-element/package.json
- packages/ignite-element/vite.config.ts
- packages/ignite-element/scripts/verify-exports.mjs
Tests (TDD — golden neutral↔Anthropic fixtures + scalar helpers + renamed-port type tests):
- packages/ignite-element/src/tests/tools.test.ts
- packages/ignite-element/src/tests/types/tools.types.test.ts
- packages/ignite-element/src/tests/tools.anthropic.test.ts
- packages/ignite-element/src/tests/tools.scalar.test.ts
Docs + changeset:
- docs/ignite-tools.md
- .changeset/ignitetools-anthropic-dialect.md

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
