# igniteTools showcase Phase A — make the headless agent runtime DOM-free (getSchema/execute/on/watchView run in pure Node

## Source
Created with `fas create-task` on 2026-06-26.

## Problem
The agent runtime is documented as headless but getSchema()/execute() call document.createElement via createRuntimeHost (IgniteElementFactory.ts ~line 330), so pure-Node/edge use currently needs a jsdom polyfill — found while dogfooding igniteTools (the anthropic example). The headless host is only ever used as an EventTarget: the runtime on() does host.addEventListener/removeEventListener, and effect emits go through createDomEmit -> host.dispatchEvent. Node 22 ships EventTarget and CustomEvent globally. Fix: make createRuntimeHost fall back to a DOM-free EventTarget-based host when typeof document is undefined; keep document.createElement when a real or jsdom DOM exists (zero behavior change there). Do NOT polyfill document globally — the render path (createRuntimeDomBridge / the custom element) legitimately needs a real DOM and must keep requiring one. Add a pure-Node headless vitest (environment node, zero jsdom). Unblocks Phase B and C (the headless terminal agent showcase). Related queued work: the observe() channel task and canExecute.

## Automation admission
- Expected operator value: Improves operator leverage around "igniteTools showcase Phase A — make the headless agent runtime DOM-free (getSchema/execute/on/watchView run in pure Node, no jsdom)" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- createRuntimeHost returns a DOM-free EventTarget-based host when document is undefined and a real element otherwise
- getSchema, execute, on, and watchView/getView round-trip in a node-environment vitest with zero jsdom
- existing jsdom/browser behavior unchanged — full package suite stays green
- the DOM render path (createRuntimeDomBridge / custom element) still requires a real DOM (unchanged)
- a minor changeset documents the headless-runtime improvement
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
- packages/ignite-element/src/IgniteElementFactory.ts
- packages/ignite-element/src/tests/agent-runtime-headless-node.test.ts
- .changeset/headless-agent-runtime-dom-free.md

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
