# igniteTools showcase Phase C — terminal-to-browser bridge: headless Claude agent and a browser ignite UI drive one live

## Source
Created with `fas create-task` on 2026-06-26.

## Problem
A Node process owns the canonical headless smart-home (the Phase B component, DOM-free) plus the igniteTools + Claude agent loop — the terminal face. It serves a WebSocket (broadcast the view on every change, accept commands) and a static page. The browser renders the same home as an ignite-element web component (real DOM — the render path), live from the WebSocket, and is clickable to control devices (commands flow back to the server). Bidirectional: the agent (terminal) and a human (browser) drive the SAME live home in real time — agent acts then broadcast then browser animates; human clicks then command then the agent observes on its next loop. The thin WebSocket bridge stands in for actor-web native location transparency, which is not turnkey yet (the @actor-web/runtime peer is not linked here; cross-repo and publish pending) — frame the WS explicitly as the seam actor-web fills, and file a follow-up to swap in real actor-web once it lands. GAP-CATCHING: does one ignite component cleanly serve both the headless agent and the browser render (cross-runtime sharing); the view/event stream as the broadcast channel; command round-trip latency vs the observation contract; reconnection and late-join. Produces a recordable demo for a promo video. Depends on Phase B.

## Acceptance criteria
- a Node server runs the headless home plus the agent loop plus a WebSocket and serves the browser page
- the browser ignite-element UI renders the home live from the WebSocket and can send commands back
- the agent (terminal) and a human (browser) both move the same live home in real time (bidirectional)
- documented one-command run steps producing a recordable promo demo
- the thin WS bridge is framed as an actor-web stand-in, with a follow-up task filed to use real actor-web
- a GAPS.md update capturing cross-runtime and bridge gaps
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
- examples/agents/smart-home/src/server.ts
- examples/agents/smart-home/src/shared/home.ts
- examples/agents/smart-home/src/browser/main.ts
- examples/agents/smart-home/src/browser/home-element.ts
- examples/agents/smart-home/index.html
- examples/agents/smart-home/src/bridge.ts
- examples/agents/smart-home/README.md
- examples/agents/smart-home/GAPS.md

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
