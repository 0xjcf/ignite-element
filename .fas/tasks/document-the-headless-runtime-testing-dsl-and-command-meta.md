# Document the headless runtime, testing DSL, and command metadata APIs

## Source
Created with `fas create-task` on 2026-06-04.

## Problem
Three real, public v3 APIs are only shown inside guides, with no API-reference page: (1) the headless runtime on the igniteCore return — execute, getState, getView, getSchema, on, watch, watchView, record (verified in packages/ignite-element/src/types/agent.ts); (2) the testing DSL and agent/story API exported as test from ignite-element and ignite-element/xstate — given/when/expectState/expectEvent plus accessibilityBridge, expectControls, serializeTrace, expectTrace, snapshotStory, and story.record/execute/until/trace/lifecycle/summary; (3) the command metadata helpers command.number/string/boolean/enum/object/array. The API-ref section currently covers only igniteCore, define-ignite-config, and renderers. Add reference pages with the real signatures and return shapes (e.g. execute returns { state, events }; getSchema shape).

## Automation admission
- Expected operator value: Improves operator leverage around "Document the headless runtime, testing DSL, and command metadata APIs" by reducing manual coordination, repetitive execution, or trust gaps.
- Observability surface: Use authoritative FAS surfaces such as `fas runtime status`, `fas runtime watch`, workflow logs, receipts, or notifications to show whether the automation is active, quiet, stalled, blocked, or complete.
- Recovery path: A human can abort, retry, recover, or rerun this workflow without leaving stale queue, lease, branch, or current-task state.
- Autonomy mode: advisory
- Promotion criteria: Promote beyond advisory only after dogfood runs prove clear operator value, trustworthy observability, and bounded recovery.

## Acceptance criteria
- New API-reference pages (or sections) document the headless runtime methods, the testing/agent/story DSL, and the command metadata helpers, each with signatures and return shapes taken from the real exports
- Pages are added to the sidebar under API in astro.config.mjs
- All code examples typecheck under the docs code-block guardrail
- Pages are cross-linked from the testing and agent-runtime-v3 guides
- Only current v3 docs are touched
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- docs/site/astro.config.mjs
- docs/site/src/content/docs/api/headless-runtime.mdx
- docs/site/src/content/docs/api/command-metadata.mdx
- docs/site/src/content/docs/api/testing-dsl.mdx
- docs/site/src/content/docs/guides/agent-runtime-v3.mdx
- docs/site/src/content/docs/guides/testing.mdx
- docs/site/scripts/doc-examples-baseline.json

## Scope Amendments
- 2026-06-04: Promoted the deliverables implied by the acceptance criteria into
  explicit scope. The planner only auto-detected `astro.config.mjs`, but the
  criteria require new API-reference pages (`api/headless-runtime`,
  `api/command-metadata`, `api/testing-dsl`), cross-links from the
  `agent-runtime-v3` and `testing` guides, and all examples passing the doc
  typecheck guardrail. Clearing the agent-runtime-v3 inference-artifact baseline
  entry (via a `no-check` fence on the reader-supplied-machine block) also edits
  `doc-examples-baseline.json`. No source/runtime files were changed.

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
