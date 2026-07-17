# Extract framework-neutral Voice Workbench contracts and deterministic cores

## Source
Created with `fas create-task` on 2026-07-17.

## Problem
Create example-owned serializable document, speech, tool, capability, command, fact, request, receipt, and failure vocabulary. Remove Ignite projection and Neutral tool types from authoritative domain, reducer, policy, actor-protocol, and pure projection contracts. Split deterministic presentation reduction, selectors, provider request/response mapping, validation, sanitization, and decoding away from effectful modules while preserving behavior and public compatibility through outward adapters.

## Acceptance criteria
- Domain and application contracts no longer derive authoritative types from ignite-element or concrete projection targets.
- Conversation, artifact, presentation, policy, model protocol, search protocol, and pricing protocol logic is deterministic and testable without Ignite, DOM, Node, fetch, timers, AbortController construction, provider SDKs, or environment configuration.
- The ports/session ownership cycle is removed at the contract level: actor event unions compose application-owned request and receipt data rather than ports extracting private actor events.
- Existing public schemas, serialized facts, machine snapshots, artifact revisions, correlation semantics, and behavior remain compatible unless Gate 0 explicitly approved an amendment.
- The architecture violation baseline is reduced for every moved dependency and no new violation is admitted.
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
- examples/agents/voice-workbench/src/domain.ts
- examples/agents/voice-workbench/src/session.ts
- examples/agents/voice-workbench/src/agent-loop.ts
- examples/agents/voice-workbench/src/capability-federation.ts
- examples/agents/voice-workbench/src/ports.ts
- examples/agents/voice-workbench/src/workbench-policy.ts
- examples/agents/voice-workbench/src/workbench-view.ts
- examples/agents/voice-workbench/src/domains/contracts.ts
- examples/agents/voice-workbench/src/domains/registry.ts
- examples/agents/voice-workbench/src/model.ts
- examples/agents/voice-workbench/src/web-search-capability.ts
- examples/agents/voice-workbench/src/domains/product-pricing/price-capability.ts

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
