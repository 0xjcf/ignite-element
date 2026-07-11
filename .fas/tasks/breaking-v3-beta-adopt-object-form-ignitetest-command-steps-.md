# BREAKING (v3 beta): adopt object-form igniteTest command steps and artifact intent vocabulary

## Source

Created with `fas create-task` on 2026-07-10.

## Problem

Replace positional igniteTest.when(commandName, input?) with the self-describing object form when({ name, input? }) before the voice/text workbench is implemented. Remove positional support during the v3 beta window rather than deprecating it. Preserve command-name and input inference with a discriminated command-step type: input is required for commands that accept one argument and omitted for no-argument commands. Align the workbench model-facing vocabulary on consumer-owned createArtifact, reviseArtifact, and completeResponse commands. Keep ProjectionDocument validation, revision application, coherent inspection, and channel committers internal to Ignite; do not add built-in projection CRUD, a public inspect method, or a second authoring DSL.

## Acceptance criteria

- igniteTest uses when({ name: "commandName", input }) and supports when({ name: "noArgCommand" }) without positional overloads.
- The object argument is inferred as a command-name discriminated union: required command inputs are required and correctly typed, while no-argument commands do not require input.
- All package tests, examples, and documentation migrate from when(name, payload?) to object-form command steps in the same breaking change.
- The voice/text workbench brief and fixtures use createArtifact, reviseArtifact, and completeResponse as consumer-owned commands rather than upsertProjection or patchProjection.
- ProjectionDocument remains the internal validated representation; Ignite does not ship projection CRUD commands or expose public bind, inspect, project, or registry APIs.
- Focused type/runtime tests, docs example checks, and full verification cover the migration.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution

- Replace the positional `when(commandName, input?)` signature with a single
  object-form command step: `when({ name, input })`.
- Model the step as a command-name discriminated union so TypeScript requires
  `input` exactly when the selected command requires it.
- Use `name` and `input` consistently with the existing `igniteTools` call
  envelope and the upcoming workbench vocabulary.

## Alternatives considered

- Keep positional arguments: rejected because command intent and input become
  ambiguous at call sites.
- Support both positional and object forms: rejected because v3 is still in
  beta and compatibility overloads would preserve the ambiguity.
- Use `{ command, payload }`: rejected in favor of the owner-selected
  `{ name, input }` vocabulary, which aligns with model tool calls.

## Affected files

- packages/ignite-element/src/testing.ts
- packages/ignite-element/src/tests/testing.test.ts
- packages/ignite-element/src/tests/types/testing.types.test.ts
- docs/testing.md
- docs/site/src/content/docs/api/testing-dsl.mdx
- examples
- README.md
- docs/can-execute.md

## Scope Amendments

- Type: scope-expansion
- Added at: 2026-07-11
- Trigger: repo-wide positional igniteTest.when search after implementation
- Reason: Acceptance requires all documentation to migrate in the same breaking change; these two examples still used the removed positional form.
- Added paths: README.md, docs/can-execute.md
- Evidence source: senior engineer verification handoff
- Evidence: senior engineer verification handoff | README.md | README.md:294 and docs/can-execute.md:136 contain positional scenario.when calls.
- Accuracy signal: Both snippets target igniteTest scenario.when, not unrelated execute or selector APIs.
- Follow-up needed: Migrate both snippets in a docs-only incremental commit and rerun docs/search gates.

## Implementation plan

- Add failing runtime and type tests for required-input, no-input, invalid-name,
  and invalid-input object-form command steps.
- Replace the public `when` signature and implementation without retaining a
  positional overload.
- Migrate package tests, examples, and documentation in one breaking sweep.
- Re-run repository-wide search for positional `.when(...)` calls before
  closeout and confirm the voice/text workbench brief uses artifact intent.

## Verification plan

- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks

- A loose object type could weaken command-name/input inference; require a
  discriminated union derived from the command map.
- A compatibility overload would preserve two ways to express the same test
  step and undermine the v3 cleanup.
- Do not turn artifact vocabulary into built-in Ignite commands.

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
