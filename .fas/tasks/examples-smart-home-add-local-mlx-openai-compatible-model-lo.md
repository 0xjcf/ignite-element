# examples/smart-home: add local MLX OpenAI-compatible model loop and demo mode

## Source
Created with `fas create-task` on 2026-07-05.

## Problem
Extend the existing smart-home agent example so the same headless runtime and igniteTools loop can run against a local MLX server exposed through an OpenAI-compatible /v1/chat/completions endpoint. Keep the example self-contained: tests use fake fetch or scripted responses, live validation is opt-in, and the example fails with actionable setup guidance when no local server is running. Include a CLI path such as npm run mlx and, if the existing bridge shape supports it cleanly, a demo:mlx mode where the local model and browser UI share one runtime.

## Automation admission
- Expected operator value: Improves operator leverage around "examples/smart-home: add local MLX OpenAI-compatible model loop and demo mode" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- The smart-home example exposes a local MLX/OpenAI-compatible model path without requiring cloud API keys.
- CI-safe tests cover the OpenAI-compatible model loop using fake responses; no test requires an installed MLX model or network server.
- README instructions show how to start mlx_lm.server and run the Ignite smart-home prompt locally.
- The example keeps top-level examples self-contained and does not add fas-local workspace packages as dependencies.
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
- examples/agents/smart-home
- docs/ignite-tools.md

## Scope Amendments
- Type: scope correction
- Added at: 2026-07-06T15:22:00Z
- Trigger: closeout plan-alignment hold reported `packages/ignite-element/src/tools/openai` as a missing planned path.
- Reason: the OpenAI-compatible dialect package was implemented by the prerequisite task; this task consumes that dialect from the smart-home example and only needs example/docs changes.
- Evidence source: closeout-readiness
- Evidence path: `.fas/state/closeout-readiness/latest.json`
- Evidence detail: missing planned file was `packages/ignite-element/src/tools/openai` while implemented files were under `examples/agents/smart-home` plus `docs/ignite-tools.md`.
- Accuracy signal: focused tests, example runtime lane, and fast FAS code checks passed without package dialect changes.
- Follow-up: none.

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
