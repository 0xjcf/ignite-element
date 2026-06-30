# Fix smart-home GAPS #6 by adding array-input command coverage to the smart-home example

## Source
Created with `fas create-task` on 2026-06-30.

## Problem
Fix smart-home GAPS #6 by adding array-input command coverage to the smart-home example

## Acceptance criteria
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The smart-home example includes an array-input command whose neutral schema is an array and whose provider schema is Option D wrapped under `{ value }`.
- The smart-home agent runtime test proves Anthropic `toolCalls()` unwraps the array envelope before `run()`.
- `examples/agents/smart-home/GAPS.md` marks GAPS #6 fixed.

## Proposed solution
- Add a `dimRooms(rooms: Room[])` smart-home command that dims selected rooms by turning their lights off and closing blinds.
- Declare the command input with `command.array(command.enum(ROOMS), { minItems: 1 })` so the adapter must wrap an array schema under `value`.
- Cover schema shape and round-trip behavior in `src/agentLoop.test.ts`.

## Alternatives considered
- Change core scalar/array wrapping behavior: rejected because package-level scalar helpers already cover non-object wrapping; GAPS #6 asks for example coverage.
- Add a synthetic test-only command: rejected because the smart-home example should dogfood a realistic command the agent could use.

## Affected files
- `examples/agents/smart-home/src/home.ts`
- `examples/agents/smart-home/src/agentLoop.test.ts`
- `examples/agents/smart-home/README.md`
- `examples/agents/smart-home/GAPS.md`

## Scope Amendments
- Scope is narrowed to the smart-home example. Core schema helpers and package-level array validation are existing surfaces and should remain unchanged unless tests expose a defect.

## Implementation plan
- First add failing smart-home tests for array schema wrapping and array tool-call unwrap/run behavior.
- Add the `dimRooms` command and state transition to the smart-home machine.
- Refresh the smart-home README command-schema coverage summary.
- Mark GAPS #6 fixed after the focused tests pass.

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
