# Turn the voice workbench right rail into a live runtime inspector and harden capability reliability

## Source
Created with `fas create-task` on 2026-07-14.

## Problem
Replace the static proof rail with an interactive runtime inspector. Keep active parallel machine state, actor facts, and external capability outcomes visually distinct. Turn Browser, Terminal, Speech, and Headless channel cards into honest previews of the same authoritative component view without implying cross-process transport. Replace the flat all-command list with a clickable explorer driven by the exact current model manifest plus a clearly separated all-component blueprint; show description, owner, live availability, gated status, nested input schema, constraints, and recent receipts. Strengthen generic command and semantic-node field descriptions and deterministic completion repair without adding shopping-specific actor behavior. Make HTTP 429 and other capability failures bounded and actionable through structured retry metadata, cache/backoff policy, and optional configured provider fallback while never fabricating evidence. Do not add a public Ignite API or wrapper controller.

## Automation admission
- Expected operator value: Improves operator leverage around "Turn the voice workbench right rail into a live runtime inspector and harden capability reliability" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- Live inspector updates from snapshot.matches-derived view state and separately labels MLX model readiness, actor facts, and capability outcomes.
- Browser, Terminal, Speech, and Headless selectors preview the same current actor projection; commit receipts remain distinct from previews and actual remote terminal synchronization is not claimed.
- The schema explorer renders the exact availability-scoped model manifest, separates internal component commands, and exposes command descriptions, owners, gated availability, nested input schema, required fields, constraints, and recent execution outcomes.
- Generic schema descriptions and completion validation improve model repair without prompt-specific shopping logic or self-authorizing model code.
- Capability rate-limit handling returns bounded structured facts, respects retry guidance, prevents retry storms, and may use only configured provider fallbacks; unsupported evidence remains unverified.
- TDD covers live state changes, preview selection, schema details and availability, and deterministic capability failure/recovery behavior before implementation.
- DDD keeps derived render state in igniteCore.view, pure preview/schema formatting in the functional core, and network/cache/backoff coordination in the imperative shell.
- No new igniteCore surface, public inspection API, or cross-process transport is introduced.
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
- examples/agents/voice-workbench/src/session.ts
- examples/agents/voice-workbench/src/session.headless.test.ts
- examples/agents/voice-workbench/src/workbench.tsx
- examples/agents/voice-workbench/src/workbench.test.tsx
- examples/agents/voice-workbench/src/styles.ts
- examples/agents/voice-workbench/src/terminal.ts
- examples/agents/voice-workbench/src/agent-loop.ts
- examples/agents/voice-workbench/src/agent-loop.test.ts
- examples/agents/voice-workbench/src/capability-federation.ts
- examples/agents/voice-workbench/src/capability-federation.test.ts
- examples/agents/voice-workbench/src/web-search-capability.ts
- examples/agents/voice-workbench/src/web-search-capability.test.ts
- examples/agents/voice-workbench/server/brave-web-search.ts
- examples/agents/voice-workbench/server/brave-web-search.test.ts
- examples/agents/voice-workbench/src/main.tsx
- examples/agents/voice-workbench/src/main.test.tsx
- examples/agents/voice-workbench/README.md

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
