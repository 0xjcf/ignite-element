# ADDITIVE: add expectView to the test DSL per docs/v3-api-con

## Source
Created with `fas create-task` on 2026-06-18.

## Problem
ADDITIVE: add expectView to the test DSL per docs/v3-api-consistency.md. Mirror the runtime getView() — assert the projected view in the scenario harness (lastResult.view ?? component.getView()), alongside the existing expectState. Does NOT rename expectState (the expectState->expectSnapshot rename is the separate BREAKING item). Affected files: packages/ignite-element/src/testing.ts (IgniteTestScenario interface + IgniteTestDriver), and tests covering expectView pass/fail.

## Automation admission
- Expected operator value: Improves operator leverage around "ADDITIVE: add expectView to the test DSL per docs/v3-api-consistency.md. Mirror the runtime getView() — assert the projected view in the scenario harness (lastResult.view ?? component.getView()), alongside the existing expectState. Does NOT rename expectState (the expectState->expectSnapshot rename is the separate BREAKING item). Affected files: packages/ignite-element/src/testing.ts (IgniteTestScenario interface + IgniteTestDriver), and tests covering expectView pass/fail." by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- The defect no longer reproduces.
- A regression test covers the fix.
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
- `packages/ignite-element/src/testing.ts` — add `expectView` to the `IgniteTestScenario` interface + `IgniteTestDriver` (asserts the projected view via `component.getView()`); add an `IgniteViewExpectation<View>` type and an `assertView` helper mirroring `IgniteStateExpectation`/`assertState`; thread a `View` generic (default-typed → non-breaking) through the scenario type, driver, and `createTestScenario` factory (add a `RuntimeView<Runtime>` extractor) so the expectation is typed from the component.
- `packages/ignite-element/src/tests/testing.test.ts` — `expectView` coverage (partial-object match + predicate form, pass + fail), alongside the existing `expectState` tests.
- `docs/site/src/content/docs/api/testing-dsl.mdx` — document `expectView` beside `expectState` in the Testing DSL reference (the guide `testing.mdx` only links to this reference, so per-method docs live here).
- `.changeset/expectview-test-dsl.md` — minor changeset (additive public test-DSL method).

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
