# Split Voice Workbench provider protocols from imperative adapters

## Source
Created with `fas create-task` on 2026-07-17.

## Problem
Move nondeterministic MLX, web-search, product-pricing, browser microphone, speech synthesis, timeout, abort, retry, and environment work into explicitly named replaceable adapters. Keep pure request construction, response decoding, validation, ranking, sanitization, policy, proof normalization, and error classification in deterministic protocol/core modules. Compose adapters through application-owned ports and return correlated expected outcomes as facts or receipts.

## Acceptance criteria
- No file classified as deterministic core, actor, policy, protocol, or pure projection performs fetch, timer creation, AbortController construction, environment lookup, DOM or Node access, provider calls, randomness, or wall-clock work.
- MLX model transport and readiness, web search transport, and product-pricing transport each have separate pure protocol and imperative adapter modules.
- Capability federation separates pure ownership/collision resolution from asynchronous execution coordination and expected adapter failures cross the boundary as typed data.
- Browser voice and speech adapters remain environment-specific and replaceable, with lifecycle callbacks translated into correlated receipts consumed by authoritative child machines.
- Deterministic fakes prove success, invalid response, unavailable, timeout, cancellation, retry, stale receipt, and provider failure paths.
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
- examples/agents/voice-workbench/src/model.ts
- examples/agents/voice-workbench/src/web-search-capability.ts
- examples/agents/voice-workbench/src/capability-federation.ts
- examples/agents/voice-workbench/src/domains/product-pricing/price-capability.ts
- examples/agents/voice-workbench/src/adapters/mlx-model-turn.ts
- examples/agents/voice-workbench/src/adapters/browser-voice.ts
- examples/agents/voice-workbench/src/adapters/browser-speech.ts
- examples/agents/voice-workbench/src/workbench-runtime.ts
- examples/agents/voice-workbench/server

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
