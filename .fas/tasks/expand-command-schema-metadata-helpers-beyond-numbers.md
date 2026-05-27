# expand command schema metadata helpers beyond numbers

## Source
Created with `fas create-task` on 2026-05-26.

## Problem
Follow-up from inspector runtime investigation. command(fn, metadata), command.number(...), and getSchema() command metadata are implemented and tested, but docs/site agent-runtime-v3 still identifies schema depth as a remaining gap for strings, booleans, enums, objects, and arrays. Extend the low-friction helper set while keeping metadata optional and JSON-serializable.

## Acceptance criteria
- Command helper exposes documented string, boolean, enum, object, and array metadata builders or an intentionally smaller justified subset.
- getSchema() preserves current commands/events/state compatibility while returning the richer metadata.
- Focused runtime, type, and docs/examples coverage demonstrates the new helpers.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-core/src/RenderArgs.ts
- packages/ignite-element/src/runtime/commands.ts
- packages/ignite-element/src/runtime/agent.ts
- packages/ignite-element/src/types/schema.ts
- packages/ignite-element/src/tests/IgniteCore.test.ts
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- docs/site/src/content/docs/guides/agent-runtime-v3.mdx

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
