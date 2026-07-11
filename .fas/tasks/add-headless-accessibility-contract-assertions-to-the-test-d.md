# Add headless assertions for dynamic projection documents and behavior facts

## Source
Created with `fas create-task` on 2026-07-09.

## Problem
Add deterministic headless testing support for the replacement architecture. Tests should assert coherent behavior facts, command descriptions/input/availability, validated ProjectionDocument state, incremental upsert/patch operations, command-backed action references, model-authored text/speech data, and actor-web behavior paths where available. Do not add command label, focus, announcement, validation-copy, or error-copy metadata to igniteCore. Clarify that accessible-name, focus order, keyboard behavior, and live-region behavior remain rendered DOM concerns.


## Acceptance criteria
- Scenario tests assert validated projection documents and actor-owned projection state without a DOM.
- Tests reject raw JSX, JavaScript, event handlers, imports, DOM references, unsupported node kinds, invalid patches, and actions targeting unknown or unavailable commands.
- Tests assert command descriptions, input contracts, current availability, model-authored text/speech fields, and actor-web behavior paths where available.
- Failure messages identify the invalid node, patch, action, command, or behavior fact without claiming browser accessibility conformance.
- Type tests cover only the minimal public testing surface proven necessary by the replacement implementation.
- Docs distinguish headless projection/behavior assertions from rendered DOM accessibility verification.
- TDD and DDD requirements remain mandatory.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-element/src/testing.ts
- packages/ignite-element/src/tests/testing.test.ts
- packages/ignite-element/src/tests/types/testing.types.test.ts
- docs/site/src/content/docs/guides/accessibility-first.mdx

## Scope Amendments
- None.

## Implementation plan
- Derive assertions from the replacement ProjectionDocument validator and actor-state contract rather than duplicating schemas.
- Add deterministic scripted fixtures that exercise create, patch, reject, command-action, text, and speech flows.
- Keep browser-only assertions out of the headless DSL.

## Execution workflow

Use `6-agent` mode for this shared-contract work. The architect owns the
headless contract boundary, the staff engineer owns the shared test-plan
contract, and one senior engineer is the sole code writer for testing sources,
fixtures, and task-scoped documentation. QA validates deterministic coverage,
SRE reviews runtime/lifecycle implications, and the reviewer performs the final
exact-SHA assessment. Require an explicit handoff after each read-only gate;
the root session owns full verification, CodeRabbit, and closeout.

## Verification plan
- After each commit-plan step, run focused testing/runtime/type tests and
  `fas validate-task`, then create a separate incremental commit.
- Create or refresh the final review summary artifact before task completion.
- Use the epic shared full verification and CodeRabbit review at closeout.

## Risks
- Avoid turning the testing DSL into a parallel projection authoring API.
- Avoid asserting accessibility properties that require a rendered browser.

## Dependencies
- Depends on task-1783650880370.
- Blocks task-1783613728381.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
