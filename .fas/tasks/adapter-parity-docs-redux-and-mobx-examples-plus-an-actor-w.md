# Adapter parity docs: Redux and MobX examples plus an actor-w

## Source
Created with `fas create-task` on 2026-06-04.

## Problem
The v3 docs are XState-centric. Redux and MobX appear only as 'swap the source' mentions with no complete examples, and actor-web — a sizable public surface (read-model vs command sources, transport states/status, send vs ask, source handles) exported via ignite-element/actor-web and @ignite-element/adapters — has only a brief concepts snippet. For a library that advertises four adapters the coverage is uneven. Add real, runnable Redux (slice and store) and MobX examples at parity with the XState first-component/concepts examples, and a dedicated actor-web guide.

## Acceptance criteria
- Complete runnable Redux (slice + store instance) and MobX examples exist at parity with the XState first-component/concepts coverage (source, view, commands, effects)
- A dedicated actor-web guide covers read-model vs command source handles, transport state/status, send vs ask, and when to use ignite-element/actor-web vs ignite-element/xstate
- Signatures match the real ReduxBlueprintConfig/ReduxInstanceConfig/MobxConfig/ActorWebConfig exports
- All examples typecheck under the docs code-block guardrail
- Sidebar updated in astro.config.mjs; only current v3 docs touched
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- docs/site/astro.config.mjs

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
