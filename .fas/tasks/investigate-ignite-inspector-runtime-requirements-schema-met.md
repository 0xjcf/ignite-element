# investigate ignite inspector runtime requirements, schema metadata gaps, and effects ergonomics follow-up tasks

## Source
Created with `fas create-task` on 2026-03-23.

## Problem
The original task was a placeholder umbrella for inspector-facing runtime needs:
runtime requirements, schema metadata gaps, and effects ergonomics. Current repo
state needed investigation before implementation because several suspected gaps
may already be covered by prior v3 runtime work.

## Investigation summary
- Already implemented: `igniteCore(...)` returns a headless runtime with
  `execute()`, `getState()`, `getView()`, `getSchema()`, `on()`, `watch()`,
  `watchView()`, and `record()`.
- Already implemented: command metadata helpers support `command(fn, metadata)`
  and `command.number(...)`; `getSchema()` returns command metadata while plain
  command functions remain valid.
- Already implemented: story recording supports behavior traces, lifecycle
  evidence, summaries, bounded `until(...)`, and `stop()`.
- Already implemented: the scenario-style testing DSL supports
  `given(...)`, `when(...)`, `expectState(...)`, `expectEvent(...)`,
  `expectEvents(...)`, and `expectNoEvents()`.
- Remaining gap: workflow/story assertions need a stable helper or serializable
  trace snapshot shape for Vitest and Playwright.
- Remaining gap: command schema helper depth is limited to numbers; docs call
  out strings, booleans, enums, objects, and arrays as future inspector needs.
- Remaining gap: behavior stories do not yet have a DOM/accessibility bridge
  that maps proven workflows to rendered controls and accessible names.

## Evidence
- `packages/ignite-element/src/runtime/agent.ts`
- `packages/ignite-element/src/runtime/commands.ts`
- `packages/ignite-element/src/types/agent.ts`
- `packages/ignite-element/src/types/schema.ts`
- `packages/ignite-element/src/testing.ts`
- `packages/ignite-element/src/tests/IgniteCore.test.ts`
- `packages/ignite-element/src/tests/testing.test.ts`
- `packages/ignite-element/src/tests/types/igniteCore.types.test.ts`
- `docs/site/src/content/docs/guides/agent-runtime-v3.mdx`
- Command: `pnpm exec vitest --config vitest.config.ts run src/tests/IgniteCore.test.ts src/tests/types/igniteCore.types.test.ts`
  from `packages/ignite-element` passed 2 files / 49 tests.
- Command: `pnpm exec vitest --config vitest.config.ts run src/tests/testing.test.ts`
  from `packages/ignite-element` passed 1 file / 3 tests.

## Follow-up tasks created
- `add workflow trace assertions and serializable story snapshots`
- `expand command schema metadata helpers beyond numbers`
- `define DOM accessibility bridge for behavior stories`

## Affected files
- .fas/TASKS.md
- .fas/tasks/investigate-ignite-inspector-runtime-requirements-schema-met.md
- .fas/tasks/add-workflow-trace-assertions-and-serializable-story-snapsho.md
- .fas/tasks/expand-command-schema-metadata-helpers-beyond-numbers.md
- .fas/tasks/define-dom-accessibility-bridge-for-behavior-stories.md

## Acceptance criteria
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.
- Follow-up implementation tasks are created for confirmed gaps instead of
  expanding this investigation into implementation.

## Scope Amendments
- None.
