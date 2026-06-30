# Fix smart-home GAPS #5 by improving scalar value-wrapping legibility for single-argument commands without breaking Option D

## Source
Created with `fas create-task` on 2026-06-30.

## Problem
Fix smart-home GAPS #5 by improving scalar value-wrapping legibility for single-argument commands without breaking Option D

## Acceptance criteria
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- Anthropic-facing smart-home scalar schemas still use the Option D `{ value }` envelope.
- The wrapped `value` field carries a semantic description for door and scene scalar commands so the model sees what value it is choosing.
- `examples/agents/smart-home/GAPS.md` marks GAPS #5 fixed without claiming Option D was replaced.

## Proposed solution
- Preserve the shared scalar wrapper and the `{ value }` wire shape.
- Add descriptions to the smart-home scalar enum input metadata.
- Assert the provider schema includes those descriptions on `input_schema.properties.value`.

## Alternatives considered
- Rename `{ value }` to `{ door }` or `{ scene }`: rejected because the task explicitly preserves Option D and the gap describes the generic key as collision-free.
- Add a new public scalar parameter-label API: deferred because existing scalar input metadata already supports `description`, which solves this example gap without broad API surface change.

## Affected files
- `examples/agents/smart-home/src/home.ts`
- `examples/agents/smart-home/src/agentLoop.test.ts`
- `examples/agents/smart-home/GAPS.md`

## Scope Amendments
- Scope narrowed to the smart-home example. Package-level scalar strictness and broader provider wrapper follow-ups remain covered by existing queued igniteTools PR2 follow-up work.

## Implementation plan
- First update the smart-home Anthropic schema test to require semantic descriptions on scalar `{ value }` properties while preserving the Option D key.
- Add scalar enum input descriptions in the smart-home command metadata.
- Update the gap tracker once the focused test proves the provider-facing schema is more legible.

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
