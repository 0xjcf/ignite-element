# Introduce the actor-backed Voice Workbench command and read-model port

## Source
Created with `fas create-task` on 2026-07-17.

## Problem
Add a framework-neutral application boundary through which model and capability adapters obtain the current model read model, discover the availability-scoped command manifest, and submit proposed semantic commands for deterministic actor admission. Preserve the parent-supervised compound topology and child machines. Rewire the model-turn application path to this port so Ignite remains an optional projection and command-binding adapter rather than a required execution authority.

## Acceptance criteria
- The application command/read-model port is defined in example-owned types and exposes only serializable manifest, proposal, result, fact, and receipt data.
- A direct actor-backed implementation performs schema admission, command availability, policy and authorization checks, event dispatch, and correlated result observation without constructing an Ignite component.
- The MLX model-turn application boundary no longer accepts VoiceWorkbenchComponent or calls Ignite APIs directly.
- Terminal and headless tests can execute an accepted and rejected model proposal using the actor-backed port alone.
- Machine raw state, child ownership, event correlations, graph reachability, exact public Ignite schema, and existing projection behavior remain stable.
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
- examples/agents/voice-workbench/src/ports.ts
- examples/agents/voice-workbench/src/session.ts
- examples/agents/voice-workbench/src/model-turn.ts
- examples/agents/voice-workbench/src/workbench-component.ts
- examples/agents/voice-workbench/src/adapters/mlx-model-turn.ts
- examples/agents/voice-workbench/src/terminal.ts
- examples/agents/voice-workbench/src/headless-proof.ts

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
