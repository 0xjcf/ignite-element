# Evaluate headless projection testing ergonomics from workbench dogfood

## Source

Created with `fas create-task` on 2026-07-09.

## Problem

After the voice/text workbench lands with deterministic tests using existing headless APIs, evaluate whether repeated consumer friction justifies any additional testing ergonomics. Start from `expectSnapshot`, `expectView`, `getSchema`, `canExecute`, emitted events, and ordinary test-runner assertions. Prefer fixtures, documentation, or internal helpers. Do not assume a new public matcher, a public `inspect()` method, projection CRUD, or a second authoring DSL is needed.

## Acceptance criteria

- The audit cites concrete repeated patterns or diagnostics from the completed
  voice/text workbench test suite.
- Existing headless APIs and ordinary assertions are evaluated before any new
  public API is proposed.
- Fixture, documentation, and internal-helper improvements are preferred over a
  projection-specific testing DSL.
- If no material ergonomics gap remains, the task closes with an evidence-backed
  no-change verdict.
- Any proposed public API requires a separate implementation task and must not
  expose private coherent inspection, bind, project, registry, or committer
  machinery.
- TDD and DDD requirements remain mandatory.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution

- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered

- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files

- examples/agents/voice-workbench
- packages/ignite-element/src/tests/testing.test.ts
- docs/site/src/content/docs/guides/accessibility-first.mdx

## Scope Amendments

- None.

## Implementation plan

- Review the completed workbench's create/revise/reject, command-action, text,
  and speech tests for repeated boilerplate and weak diagnostics.
- Re-express representative cases with the existing headless API and ordinary
  assertions, then classify remaining friction.
- Close with no product change or create a narrowly evidenced follow-up; do not
  implement a speculative public API in this audit.

## Execution workflow

Use `4-agent` mode. Planner, verifier, and reviewer treat this as a bounded
post-dogfood audit. One implementer may update fixtures or documentation only if
the evidence requires it.

## Verification plan

- Run the workbench's deterministic test lane and focused testing/runtime/type
  tests used by the audit.
- Run `fas validate-task` only when tracked files change; otherwise close with
  the audit evidence and review summary.

## Risks

- Avoid treating repeated test data as proof that a public matcher is needed.
- Avoid asserting accessibility properties that require a rendered browser.

## Dependencies

- Depends on task-1783613728381.
- Blocks no task; this is outside the stable-v3 critical path unless it uncovers
  a correctness defect.

## Open questions

- None captured at task creation.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
