# Fix smart-home GAPS #4 by adding focused async/long-running effect coverage for act+ack versus observe-stream settlement

## Source
Created with `fas create-task` on 2026-06-30.

## Problem
The smart-home dogfood currently proves synchronous command acknowledgement only. GAPS #4 calls out the missing contract case: a command acknowledges before a longer-running scene transition settles, and the later state/event must arrive through the observe stream rather than being folded into `run()`'s acknowledgement result. Add a focused pre-Phase-C example/test for that behavior without building the full terminal-to-browser bridge.

## Acceptance criteria
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The smart-home example has an async scene transition command that returns an acknowledgement view before the scene is fully applied.
- `igniteTools(...).observe(...)` observes the later view/event settlement for that transition.
- The focused smart-home runtime test fails before the implementation and passes after it.
- `examples/agents/smart-home/GAPS.md` marks gap #4 fixed and leaves Phase C responsible for cross-runtime bridge gaps only.

## Proposed solution
- Add an XState delayed transition to the smart-home machine for a dedicated async scene command. Keep `run()` act+ack semantics unchanged: the returned observation captures the pending scene at acknowledgement. Use `igniteTools.observe()` in the test to assert the eventual settled view and `scene-applied` event after the delayed transition.

## Alternatives considered
- Build the full Phase C terminal-to-browser bridge now: rejected for this task because the user asked to clear the remaining GAPS first, and #4 can be proven with a smaller smart-home example test.
- Add a bounded `settle` option to `execute()` now: rejected because #4 is a coverage/contract gap; no API need has been proven yet.

## Affected files
- examples/agents/smart-home/src/home.ts
- examples/agents/smart-home/src/agentLoop.test.ts
- examples/agents/smart-home/GAPS.md
- scripts/test-examples.mjs
- scripts/__tests__/test-examples.test.mjs
- package.json
- .fas-config.json

## Scope Amendments
- Scope is intentionally limited to the smart-home example and its gap tracker; no runtime API or provider dialect changes are planned.
- Validation exposed that FAS could not recognize the top-level examples lane as covering non-workspace example package tests. This task also updates the existing example runtime-test lane with explicit covered-package assertions and points FAS at `test:full`, without making examples workspace members.

## Implementation plan
- First add the failing smart-home test for act+ack versus observe-stream settlement.
- Add the minimal async scene transition command and view field needed to make the test pass.
- Update `GAPS.md` to mark #4 fixed and describe what remains deferred to Phase C.
- Add a small example-runner coverage marker so the FAS package-test gate recognizes that full verification covers changed non-workspace example tests.

## Verification plan
- Run the focused smart-home example test.
- Run the script test covering the example runtime-test lane marker.
- Run the full example runtime-test lane.
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- XState delayed transitions use timers; keep the delay short and use Vitest fake timers in the focused test to avoid flakiness.
- Do not change existing synchronous `runScene` behavior; add the async command separately so existing dogfood expectations stay stable.

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
