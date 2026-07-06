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
- examples/agents/smart-home/src/actor-web-home.ts
- examples/agents/smart-home/src/model.ts
- examples/agents/smart-home/src/agentLoop.ts
- examples/agents/smart-home/src/agentLoop.test.ts
- examples/agents/smart-home/src/home.ts
- examples/agents/smart-home/src/server.test.ts
- examples/agents/smart-home/src/server.ts
- docs/ignite-tools.md
- .fas/queue/tasks.json

## Scope Amendments
- Added `examples/agents/smart-home/src/home.ts` after the second CodeRabbit
  review identified that the local runtime session close path was a no-op and
  needed ownership of a stoppable XState actor.
- Added `examples/agents/smart-home/src/server.test.ts` to cover the bridge
  server close behavior while an OpenAI-compatible agent run is in flight.

- Type: scope-refresh-promotion
- Added at: 2026-07-06
- Trigger: dirty-low-confidence-scope
- Reason: Promoted dirty low-confidence or dependency-reachable task-packet path(s) into affected scope.
- Added paths: examples/agents/smart-home/src/agentLoop.test.ts, examples/agents/smart-home/src/home.ts, examples/agents/smart-home/src/server.test.ts
- Evidence source: task-packet dirty scope promotion
- Evidence: task-packet dirty scope promotion | .fas/state/task-packet.json | Promoted dirty path(s): examples/agents/smart-home/src/agentLoop.test.ts, examples/agents/smart-home/src/home.ts, examples/agents/smart-home/src/server.test.ts
- Accuracy signal: Path was dirty in git status and present in task-packet low-confidence/dependency-reachable scope.

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
