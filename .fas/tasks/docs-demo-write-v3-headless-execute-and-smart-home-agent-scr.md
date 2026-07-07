# docs-demo: write v3 headless execute and smart-home agent screencast script

## Source
Created with `fas create-task` on 2026-07-07.

## Problem
Created from spike capture direct-1783460401998 on 2026-07-07T21:44:53Z.

Gap identified:
- docs-demo: write v3 headless execute and smart-home agent screencast script

The v3 release has a strong headless/runtime/agent demo in the smart-home
example, but there is no concise script or shot list for recording it. Create a
release-ready script before recording so the demo shows the same story as the
docs: behavior contract first, headless execution, then an agent/tool loop.

## Acceptance criteria
- Add a markdown script / shot-list artifact for a 3-5 minute v3 screencast.
- Cover: define an Ignite behavior contract, inspect `getSchema()`, execute a command headlessly, show smart-home terminal agent control, show browser UI and terminal staying in sync, and optionally show MLX/OpenAI-compatible model configuration.
- Include exact local commands for deterministic mock mode and optional MLX mode, using existing `examples/agents/smart-home` scripts.
- Keep the task docs-only unless the script uncovers a broken documented command; create a follow-up rather than expanding scope.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Create a release/demo markdown artifact in the repo's docs or release-assets
  area, with sections for audience, length, setup, recording sequence, commands,
  fallback path, and links.
- Base the flow on `examples/agents/smart-home/README.md` and the new agent
  one-pager.

## Alternatives considered
- Recording a video directly in this task: rejected. The task should produce a
  script and shot list; recording/editing is a separate operator action.

## Affected files
- A new markdown script artifact under docs/release/demo, docs/site content, or another repo-approved release-assets location
- examples/agents/smart-home/README.md only if command wording must be corrected

## Scope Amendments
- None.

## Implementation plan
- Choose a repo location for non-runtime release collateral.
- Draft the script with exact commands and expected visual/terminal beats.
- Cross-check the commands against the smart-home README.
- Run focused markdown/docs verification.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.
- Run the relevant markdown/docs check for the chosen artifact location.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- The script can overpromise local-model setup. Keep MLX as optional and use the
  deterministic mock path as the guaranteed recording fallback.

## Dependencies
- Depends on the agent one-pager for final positioning.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
