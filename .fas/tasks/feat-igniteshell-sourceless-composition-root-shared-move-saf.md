# feat: igniteShell sourceless composition root + shared move-safe teardown (per docs/ignite-shell.md)

## Source
Created with `fas create-task` on 2026-06-18.

## Problem
Implement the igniteShell design in docs/ignite-shell.md (additive; fills the sourceless-composition gap hit by fas-studio fas-shell). DELIVERABLES in order: (1) TDD FIRST — a failing test that moves an ISOLATED igniteCore element in the DOM (disconnect then reconnect in the same tick) and asserts state is preserved; confirms the latent move-bug before the fix. (2) Shared move-safe lifecycle (Decision 1/A): in the element base (IgniteElement.ts) + factory subclasses (IgniteElementFactory.ts), defer disconnect teardown to a microtask and cancel it if the element reconnects same-tick; connectedCallback must REUSE a surviving adapter, not recreate it. Fixes isolated-adapter move-safety (shared adapters already survive via the scope guard); this is the teardown mechanism igniteShell rides. (3) Rootless mount (Decision 2/B): add an internal mountIgniteJsxOnce in ignite-renderer that reuses the SAME JSX-to-DOM core as the reactive strategy but mounts the fragment directly into the shadow root — no ignite-jsx-root wrapper, no diffing — wired ONLY through igniteShell (do NOT add a public mount mode to the strategy yet). Verify event delegation/replacement work without the wrapper node. (4) The igniteShell registrar + public export (index.ts): igniteShell(config?) returns (tagName, render) => void; config is { onConnect?: (host) => void | teardown }; render is pure ignite-JSX taking no args (render-once); idempotent customElements.define; shadow root; styles via style-in-render (NO styles config field). NO source/view/commands/events/onDisconnect/reconnect/agent-surface — that is the boundary; if any are needed it is igniteCore. (5) Tests: renders rootless (children are direct shadow-root kids so :host layout governs them); onConnect teardown fires only on true disconnect and NOT on a move. (6) Changeset: additive igniteShell primitive PLUS the igniteCore isolated-adapter move-safety behavior change. Verify: fas validate-task + verify.sh --full green. Full design + rationale (incl. why not optional-source igniteCore): docs/ignite-shell.md.

## Acceptance criteria
- The change is verified and does not introduce regressions.
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
- packages/ignite-element/src/igniteShell.ts
- packages/ignite-element/src/index.ts
- packages/ignite-element/src/IgniteElement.ts
- packages/ignite-element/src/IgniteElementFactory.ts
- packages/ignite-renderer/src/renderers/jsx/IgniteJsxRenderStrategy.ts
- packages/ignite-element/src/tests/igniteShell.test.ts
- packages/ignite-element/src/tests/IgniteElement.test.tsx
- .changeset/ignite-shell.md

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
