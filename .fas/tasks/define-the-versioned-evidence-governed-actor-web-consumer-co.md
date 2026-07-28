# Define the versioned evidence-governed Actor-Web consumer contract for Ignite

## Source
Created with `fas create-task` on 2026-07-28.

## Problem
Define the additive, optional consumer boundary through which Ignite can project Actor-Web authenticated admission facts, execution receipts, durable-session checkpoints, replay/restart state, and reconciliation outcomes without becoming the execution authority. Start from the accepted cross-repo ownership contract and Actor-Web tasks task-1785250528660, task-1785250545761, and task-1785250562339; preserve current loose structural source compatibility and treat any unavailable upstream schema as provisional rather than inventing shipped interoperability.

## Acceptance criteria
- A versioned JSON-safe consumer envelope distinguishes command proposal, schema admission, domain acceptance, execution authorization, effect intent, execution receipt, checkpoint, rehydration, and reconciliation facts.
- A source-of-truth matrix names the owner of durable facts, principal and approval state, artifact revisions, intent and correlation ids, attempt and sequence ids, retry and replay rules, and effect-confirmation receipts.
- The contract defines unsupported-version, malformed, stale, conflicting, redacted, and unavailable dispositions that fail closed as diagnostic facts.
- Projected capability availability is explicitly descriptive and the Actor-Web runtime remains responsible for execution-time authorization, payload, approval, revision, idempotency, and policy rechecks.
- Ignite Story traces, Actor-Web execution receipts, and FAS evidence bindings remain separate provenance-bearing artifacts with explicit join keys.
- Current, accepted-target, candidate, and deferred maturity labels prevent the Actor-Web task briefs from being described as already shipped.
- No public Ignite inspection, blueprint, orchestration, receipt, or universal interaction-plan API is introduced by this architecture task.
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
- docs/architecture.md
- docs/shared-architecture-model.md
- docs/source-native-provisioning.md
- docs/actor-web-evidence-governed-projections.md
- packages/ignite-adapters/src/__tests__/actor-web-canonical-compat.types.ts

## Scope Amendments
- None.

## Implementation plan
- Reconcile the accepted cross-repo ownership contract with the live Actor-Web task briefs and mark every upstream surface current accepted-target candidate or deferred.
- Define the versioned JSON-safe envelope dispositions join keys and source-of-truth matrix without implementing runtime authority in Ignite.
- Characterize compatibility against the current loose Actor-Web structural adapter and add only contract/type fixtures needed to prevent drift.
- Update architecture and source-native guidance with standalone and composed adoption boundaries.

## Verification plan
- Validate the source-of-truth matrix against Actor-Web and FAS ownership invariants.
- Run the Actor-Web canonical type-compatibility lane and documentation contract checks.
- Run fas validate-task and fast verification during the task then full verification before closeout.

## Risks
- Actor-Web task contracts may change before publication; keep provisional shapes maturity-labeled and reconcile against a versioned upstream fixture before closeout.
- Do not leak an optional Actor-Web peer into shipped declaration graphs or convert shared conventions into Ignite-owned universal semantics.
- Do not add a public inspect getBlueprint orchestration receipt or interaction-plan API from architecture speculation.

## Dependencies
- Queue dependency: task-1784909239951 defines source-native provisioning ownership.
- Queue dependency: task-1784298626529 defines the accepted Voice Workbench actor and projection boundary.
- External evidence inputs: Actor-Web tasks task-1785250528660 task-1785250545761 and task-1785250562339; these are cross-repo contract gates recorded in the brief rather than invalid local queue ids.

## Open questions
- Which exact Actor-Web package version and fixture path will become the first accepted upstream conformance source? Resolve during planning from the live Actor-Web task artifacts and keep the Ignite contract provisional until confirmed.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
