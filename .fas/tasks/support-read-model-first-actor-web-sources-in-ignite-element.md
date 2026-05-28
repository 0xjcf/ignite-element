# Support read-model-first Actor-Web sources in ignite-element

## Source
Created with `fas create-task` on 2026-05-28.

## Problem
Implement the ignite-element side of the agreed Actor-Web DX. ignite-element/actor-web should accept Actor-Web read-model sources without send(), support explicit command-capable source pairing for commands, map Actor-Web close() cleanup without app wrappers, and widen Actor-Web snapshot typings to match actor-web Ignite source snapshots. This follows the cross-repo review finding that actor-web now exposes separate read-model and command-source surfaces while ignite-element still models only command-capable sources.

## Acceptance criteria
- ignite-element/actor-web accepts typed Actor-Web read-model sources as the default source without manual generics.
- Command-capable Actor-Web sources or explicit command-source pairing remain available for components that intentionally send or ask.
- Actor-Web close() sources are cleaned up by Ignite without product code wrapping them as stop handles.
- Actor-Web snapshot typings expose the actual Actor-Web Ignite source snapshot shape including context, phase, status/value helpers, transport, and address.
- Docs and type/runtime tests cover the ideal Freedom Air-style consumer API.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-adapters/src/adapters/ActorWebAdapter.ts
- packages/ignite-element/src/igniteCore/actor-web.ts
- packages/ignite-element/src/actor-web.ts
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- packages/ignite-element/src/tests/IgniteCore.test.ts
- docs/site/src/content/docs/concepts/state-adapters.mdx
- packages/ignite-element/README.md

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
- Actor-Web source API contract defines the readModel({ host }) and commandSource pairing semantics, or this task implements only the ignite-element side against the reviewed contract shape.
- Actor-Web cleanup contract for close()/stop() is documented or explicitly mirrored from current actor-web source interfaces.
- Freedom Air final adoption remains queued until this task is packaged or otherwise consumable by Freedom Air.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
