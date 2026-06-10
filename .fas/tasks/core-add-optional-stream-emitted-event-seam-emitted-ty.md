# Core: add optional stream?() emitted-event seam + Emitted type param to IgniteAdapter

## Source
Created with `fas create-task` on 2026-06-09.

## Problem
Spike: .fas/state/spikes/emitted-event-stream-seam.md (E1, D1/D3). Add an OPTIONAL stream?(listener:(event:Emitted)=>void):{unsubscribe():void} method to IgniteAdapter (packages/ignite-core/src/IgniteAdapter.ts) + an Emitted type param (default never). Additive; non-emitting adapters omit it. Thread Emitted through to the runtime Events typing so on()/execute().events type from the source emit union. Keep core deterministic (subscription seam like subscribe, no I/O). core-decoupling.test.ts must stay green.

## Acceptance criteria
- stream?() optional on IgniteAdapter with Emitted param
- existing adapters typecheck unchanged
- core has no new deps/IO
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-core/src/IgniteAdapter.ts
- packages/ignite-element/src/tests/adapter-stream-seam.test.ts

## Scope Amendments
- Type: scope-adjustment
- Trigger: closeout flagged types/agent.ts (planned) missing + the seam test extra.
- Reason: E1 is the pure IgniteAdapter contract addition (optional `stream?()` + `Emitted` param). The runtime `Events`-inference threading originally hinted at packages/ignite-element/src/types/agent.ts requires the runtime to CONSUME the seam, so it is deferred to E2 (runtime bridge) / E3 (actor-web impl) where the factory wiring lands — types/agent.ts dropped here to keep E1 a clean, standalone contract change. Added adapter-stream-seam.test.ts (contract coverage: optional + Emitted-typed).

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
