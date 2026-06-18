# chore(examples): make spa-router idiomatic — commands via injected actor + {snapshot} view

## Source
Created with `fas create-task` on 2026-06-18.

## Problem
Pre-interop example hygiene (audit 2026-06-18). The adapter examples (mobx/redux/xstate counter, taskManager, apiShowcase, agentRuntime) are already idiomatic; spa-router is the outlier and the flagship 'real app' the nested-router worked-app builds on. (A) spa-router: (1) commands must derive from the injected actor, not module-level functions: router.tsx and pages.tsx do 'commands: () => ({ navigate, login, logout })' returning functions imported from routerStore that close over the shared routerActor; change to 'commands: ({ actor }) => ({ navigate: (to) => actor.send({ type: NAVIGATE, to }), login: () => actor.send({ type: LOGIN }), logout: () => actor.send({ type: LOGOUT }) })'. The injected actor IS the shared routerActor (source: routerActor), so behavior is identical; its own router.headless.test.ts already uses this idiom. (2) Route nav handlers through ctx.navigate instead of the module-level navigate: router.tsx navLink (L33) and pages.tsx link (L21) call the imported navigate(href) directly, bypassing commands, while page buttons correctly use ctx.navigate/ctx.login/ctx.logout. Pass ctx into the navLink/link helpers. (3) view: ({ context }) -> ({ snapshot }) in router.tsx, pages.tsx, and router.headless.test.ts (reads become snapshot.context.route etc.) for consistency with every other example and forward-alignment with the view-context canonicalization ({ snapshot } already works today). (4) routerStore.ts keeps the shared routerActor + onPopState shell wiring but drops the navigate/login/logout exports once commands own them. (B) xstateApiShowcaseRuntime.ts L47: actor.state.context.step -> actor.getSnapshot().context.step (xstate v5 idiom; do NOT use actor.state). Behavior-preserving throughout. Verify: typecheck + tests (router.headless.test.ts, taskManagerMachine.test.ts) green, fas validate-task, verify.sh --full.

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
- packages/ignite-element/src/examples/apps/spa-router/src/router.tsx
- packages/ignite-element/src/examples/apps/spa-router/src/pages.tsx
- packages/ignite-element/src/examples/apps/spa-router/src/routerStore.ts
- packages/ignite-element/src/examples/apps/spa-router/src/router.headless.test.ts

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
