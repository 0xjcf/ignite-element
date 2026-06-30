# add an observe() observation channel to the neutral igniteTools core (events + view stream) for the agent act-observe loop

## Source
Created with `fas create-task` on 2026-06-24.

## Problem
Locked design (ignitetools-pr2-design-locked): the agent observation contract is act+ACK for run()/execute() (state-at-acknowledgement), and ONGOING/long-running effects (e.g. an actor-web remote deploy: idle->deploying->deployed) are observed via the event/view stream. Today the agent harness would call runtime.on()/watchView() directly; this task gives igniteTools its own observe() channel so the act+observe toolkit comes from one place (matches the 'events + view as observations' mandate). NEUTRAL-CORE change (packages/ignite-element/src/tools/igniteTools.ts + types.ts), NOT a provider dialect. SEQUENCE WITH THE DOGFOOD task (example-dogfood-prove-the-agent-runtime) where the act->observe loop is built + proven against a real remote actor-web actor; canExecute re-gates tools as state/transport change. Out of scope for igniteTools PR2 (anthropic dialect) and PR3 (openai).

## Automation admission
- Expected operator value: Improves operator leverage around "add an observe() observation channel to the neutral igniteTools core (events + view stream) for the agent act-observe loop on async/remote adapters" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- The new functionality works as described.
- Existing behavior is not broken.
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
- .fas-config.json
- packages/ignite-element/src/tools/igniteTools.ts
- packages/ignite-element/src/tools/types.ts
- packages/ignite-element/src/tools/index.ts
- packages/ignite-element/src/tests/tools.test.ts
- packages/ignite-element/src/tests/types/tools.types.test.ts
- docs/ignite-tools.md
- examples/agents/smart-home/GAPS.md

## Scope Amendments
- Add `packages/ignite-element/src/tools/index.ts` to export the new stream
  observation types from the public `ignite-element/tools` entrypoint.
- Add `packages/ignite-element/src/tests/tools.test.ts` and
  `packages/ignite-element/src/tests/types/tools.types.test.ts` for the required
  TDD coverage of the new neutral `observe()` channel and typed stream payload.
- Add `docs/ignite-tools.md` and `examples/agents/smart-home/GAPS.md` to update
  the public design note and close the smart-home gap tracker entry for the
  shipped `observe()` channel.
- Add `.fas-config.json` because FAS closeout checks require the configured
  `testCommand` itself to name the package test lane; `npm run test:full` was
  correct behaviorally but opaque to the package-test coverage rule.

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
