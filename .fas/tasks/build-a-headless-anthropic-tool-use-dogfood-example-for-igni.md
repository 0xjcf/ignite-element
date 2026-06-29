# build a headless Anthropic tool-use dogfood example for igniteTools at examples/agents/anthropic-tool-use — a pluggable-model agent loop

## Source
Created with `fas create-task` on 2026-06-25.

## Problem
build a headless Anthropic tool-use dogfood example for igniteTools at examples/agents/anthropic-tool-use — a pluggable-model agent loop (deterministic key-free mock model + real @anthropic-ai/sdk model) driving a small igniteCore counter with no-arg and scalar (setLimit) commands, validating the anthropic ToolDialect round-trip end-to-end (getSchema to tools to tool_use to toolCalls scalar-unwrap to run to toolResult) and observing act+ack snapshot timing

## Acceptance criteria
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Establish the intended approach at a design level before editing code.

## Alternatives considered
- None recorded yet.

## Affected files
- Scope unknown.

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
