# docs: add Ignite Element for AI Agents one-pager before v3 stable

## Source
Created with `fas create-task` on 2026-07-07.

## Problem
Created from spike capture direct-1783460401998 on 2026-07-07T21:44:53Z.

Gap identified:
- docs: add Ignite Element for AI Agents one-pager before v3 stable

The current v3 docs already contain the raw material for the agent story, but it
is split across Welcome, Build for agents, Headless runtime, When to choose
Ignite, and the smart-home README. Add one concise, release-ready page that
answers "why Ignite Element for agents?" without making readers assemble the
positioning themselves.

## Acceptance criteria
- Add a current-v3 docs page titled "Ignite Element for AI Agents" under an appropriate docs section, with sidebar/navigation included.
- Explain the contract in one page: `getSchema()`, `execute()`, `canExecute()`, `getView()`, `on(...)` / `watchView(...)`, and `igniteTools`.
- Position Ignite as behavior contracts for tools and humans, not DOM scraping or a separate agent framework.
- Link to the smart-home example, Build for agents, Headless runtime, Command metadata, and Testing DSL references.
- Mention local-model / MLX and actor-web dogfood as existing example capabilities, with clear non-goals for durable model serving and distributed transport ownership.
- Keep the page concise and docs-only; do not add runtime API, example, or package changes in this task.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Add a new overview or guide page that acts as the agent-facing one-pager.
- Reuse existing verified wording from `guides/agent-runtime-v3.mdx`,
  `api/headless-runtime.mdx`, `overview/when-to-choose-ignite.mdx`, and
  `examples/agents/smart-home/README.md` instead of inventing a second contract
  vocabulary.
- Keep the call to action focused on reading the headless runtime/API docs and
  running the smart-home example.

## Alternatives considered
- Expanding the homepage: rejected because the homepage should stay a short
  on-ramp, not carry the full agent positioning.
- Adding a marketing-style landing page: rejected because the docs site should
  stay contract-first and useful to implementers.

## Affected files
- docs/site/src/content/docs/overview/** or docs/site/src/content/docs/guides/**
- docs/site/src/content/docs/index.mdx or nearby navigation only if a link is needed

## Scope Amendments
- None.

## Implementation plan
- Pick the page location and sidebar order after checking the current docs IA.
- Draft the one-pager around the contract, dogfood proof, limits, and next steps.
- Add navigation from the most relevant overview/guide surface.
- Run docs formatting/build verification.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.
- Run `pnpm run docs:build`.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- The page can drift into duplicate API reference. Keep method details linked to
  canonical API pages instead of re-documenting every signature.

## Dependencies
- Should run before the screencast script so the video narrative uses the same
  positioning.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
