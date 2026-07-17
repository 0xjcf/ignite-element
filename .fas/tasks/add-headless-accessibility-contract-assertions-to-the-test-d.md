# Evaluate executable-narrative testing ergonomics from Voice Workbench dogfood

## Source

Created with `fas create-task` on 2026-07-09.

## Problem
After the executable Voice Workbench narrative catalog lands, audit whether the multi-step igniteTest narrative helper, existing Story recorder, Story snapshot receipt, focused getters, command availability, events, and ordinary assertions express the required user, system, and projection narratives with strong diagnostics. Start from concrete dogfood evidence. Prefer documentation, example fixtures, or internal helpers; a no-change verdict is successful. Any additional public API or receipt envelope requires repeated friction and a separate implementation decision.


## Acceptance criteria
- The audit cites the completed Voice Workbench narrative catalog, coverage matrix, Story receipts, named checkpoint diagnostics, and channel evidence.
- The audit evaluates narrative preconditions, typed intents, consumer-driven external facts, passive transitions, semantic checkpoints, failure diagnostics, cleanup, and receipt portability.
- At least two repeated consumer problems are required before proposing any new public testing surface or narrative-receipt envelope; otherwise the task closes with a no-change verdict.
- Existing igniteTest assertions, record and snapshotStory evidence, focused runtime reads, ordinary test-runner assertions, and example fixtures are evaluated before public API growth.
- The audit distinguishes framework-neutral narrative friction from XState graph traversal concerns and leaves graph ownership to xstate/graph.
- The final artifact gives an explicit readiness recommendation for the downstream Story API naming verdict and optional XState bridge.
- Any tracked fixture or documentation changes pass focused verification; a report-only outcome records why no product change was needed.
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
- Review every required Voice Workbench narrative and classify repeated boilerplate, missing evidence, diagnostic gaps, and ownership ambiguity.
- Re-express representative cases with the shipped helper and existing Story primitives, then separate framework-neutral friction from Voice Workbench or XState-specific fixture concerns.
- Evaluate whether named checkpoints need only better diagnostics, an example-local coverage report, or a public receipt envelope.
- Close with a no-change verdict or a narrowly evidenced follow-up recommendation; do not implement speculative public API changes in this audit.

## Execution workflow

Use `4-agent` mode. Planner, verifier, and reviewer treat this as a bounded
post-dogfood audit. One implementer may update fixtures or documentation only if
the evidence requires it.

## Verification plan
- Run the completed Voice Workbench narrative lane and focused Ignite testing suites used by the evidence.
- Run fas validate-task only when tracked fixture or documentation files change.
- Record a review summary and naming-readiness recommendation even when the result is no product change.

## Risks
- Do not treat repeated test data alone as proof of public API need.
- Do not create a second trace, state authority, graph engine, or public coherent inspection bundle.
- Do not collapse XState graph coverage and Ignite semantic-projection evidence into one abstraction.

## Dependencies
- Depends on the completed workbench baseline task-1783613728381 and executable narrative dogfood task-1784324997164.
- Blocks the Story API naming verdict and remains an upstream input to optional XState graph-bridge evaluation.

## Open questions
- Whether the public result should remain IgniteStorySnapshot or gain a transparent narrative receipt envelope; answer only from dogfood evidence.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
