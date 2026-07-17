# Decide Story API naming and v3 beta migration from narrative dogfood

## Source
Created with `fas create-task` on 2026-07-17.

## Problem
Use the completed executable-narrative dogfood and ergonomics audit to decide whether component.record, snapshotStory, IgniteStory, and related public Story types remain the correct low-level evidence vocabulary for v3 or should be renamed before stable. Preserve the distinction that narratives are expected experience claims, recorded Stories are observed execution evidence, and serializable snapshots are portable receipts. A no-rename verdict is valid. If a rename earns its migration cost, update every supported entrypoint with compatibility aliases, changeset, migration documentation, and type and runtime coverage without creating a second trace format.

## Acceptance criteria
- The decision begins with concrete Voice Workbench narrative receipts and the post-dogfood ergonomics audit, not naming preference alone.
- The review explicitly distinguishes narrative specification, recorded Story execution, and portable receipt vocabulary.
- The task inventories record, snapshotStory, IgniteStory, Story trace and snapshot types, documentation, examples, and root, XState, Redux, MobX, and Actor-Web entrypoints.
- A keep verdict documents why the existing names remain precise and how the narrative helper presents the higher-level workflow.
- A rename verdict defines one canonical vocabulary, compatibility and deprecation aliases, changeset and migration guidance, and complete entrypoint and type coverage.
- No option adds a second recorder, trace schema, state authority, graph engine, getBlueprint alias, or public coherent inspection API.
- The optional XState bridge consumes the final vocabulary and remains downstream of this verdict.
- Focused runtime, type, entrypoint, docs, changeset, and full verification gates pass for any implemented migration.
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
- packages/ignite-element/src/types/agent.ts
- packages/ignite-element/src/testing.ts
- packages/ignite-element/src/index.ts
- packages/ignite-element/src/xstate.ts
- packages/ignite-element/src/redux.ts
- packages/ignite-element/src/mobx.ts
- packages/ignite-element/src/actor-web.ts
- docs/site/src/content/docs/api/testing-dsl.mdx
- packages/ignite-element/README.md
- examples/agents/voice-workbench/README.md
- .changeset

## Scope Amendments
- None.

## Implementation plan
- Read the Voice Workbench narrative catalog, receipts, coverage matrix, and ergonomics-audit recommendation.
- Inventory the complete public Story vocabulary and every supported export, example, document, and consumer path.
- Compare keep, clarify, and rename options against semantic precision, migration cost, discoverability, beta timing, and compatibility.
- Record an explicit reviewed verdict before editing public APIs.
- For a keep verdict, update only the documentation needed to make narrative, Story, and receipt roles clear.
- For a rename verdict, implement canonical names plus compatibility aliases, changeset, migration guidance, type tests, runtime tests, entrypoint tests, and example updates incrementally.

## Verification plan
- Run focused Story runtime, testing, type, and entrypoint suites for the inventory and any migration.
- Run documentation and example checks for updated vocabulary.
- Run fas validate-task and fast verification after each implemented migration slice.
- Run full verification and committed review before closeout.

## Risks
- Do not rename Story APIs to narrative terms if that collapses expected claims and observed evidence.
- Do not carry duplicate names indefinitely without a documented deprecation and removal policy.
- Do not let naming work widen runtime behavior, Story trace semantics, or source ownership.
- Preserve package entrypoint parity across root, XState, Redux, MobX, and Actor-Web surfaces.

## Dependencies
- Depends on task-1783610933373 so the naming decision follows completed executable-narrative dogfood and the ergonomics audit.
- Blocks task-1784171502136 so the optional XState bridge consumes final v3 narrative and Story vocabulary.

## Open questions
- Whether record and snapshotStory remain canonical, become more explicit Story names, or gain compatibility aliases to a better evidence vocabulary; dogfood evidence decides.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
