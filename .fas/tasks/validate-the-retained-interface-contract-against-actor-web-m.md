# Validate the retained-interface contract against Actor-Web Mesh Pong

## Source

Created with `fas create-task` on 2026-07-10.

## Problem
Run a bounded cross-repo consumer validation against the current Actor-Web Mesh Pong implementation after the generic Ignite capabilities and local stress example are complete. Treat Actor-Web as a read-only downstream consumer. Verify that authoritative topology sources/read models can feed a headless igniteCore contract and a retained canvas registered through the existing callable component API using generic ref/commit directives and consumer-owned drawing cadence. Require no Mesh-Pong-specific Ignite wrapper, hardcoded transport facts, DOM-owned lifecycle repair, framework scheduler configuration, or migration of simulation/controller/advisory authority into Ignite. Produce an adoption brief and measurements for the scheduling-verdict task.


## Acceptance criteria
- The validation pins the Actor-Web revision examined and maps Room/Table/Match/Result, controls, canvas, telemetry, and transport proof to explicit Actor-Web versus Ignite owners.
- The proposed consumer path uses defineActor/topology source or read-model handles directly with igniteCore named commands and keeps snapshot/transport metadata available.
- The retained canvas path proves stable context identity, generic ref/commit lifecycle, consumer-owned presentation cadence, real transport status, and authoritative fixed-step snapshots without moving the game loop into Ignite.
- The validation measures reconciliation and draw cadence and identifies whether consumer-owned scheduling is sufficient without assuming a framework scheduler.
- Remaining gaps are classified as Ignite framework, Actor-Web runtime/source, or Mesh Pong example work, with no cross-repo source edits bundled into this validation task.
- The output includes exact downstream task sequencing and verification expectations for later Actor-Web implementation PRs.
- The work is tracked in .fas/TASKS.md and has a clear implementation and verification plan.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution

- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered

- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files

- /Users/joseflores/Development/actor-web/examples/mesh-pong/ui/main.ts
- /Users/joseflores/Development/actor-web/examples/mesh-pong/workflow
- docs/retained-complex-interfaces.md

## Scope Amendments

- None.

## Implementation plan
- Pin and inspect the current Actor-Web Mesh Pong topology sources, workflow projection, UI host, turn stepper, canvas, telemetry, and transport modes read-only.
- Map each responsibility to the shipped Ignite ref/commit, keyed reconciliation, lifecycle, and consumer-owned scheduling contracts.
- Measure and document the consumer path, classify gaps, and produce inputs for scheduling-verdict task-1783719681572.
- Draft Actor-Web-owned follow-ups separately without editing Actor-Web source and validate the brief against both repositories' dependency rules.

## Verification plan

- Run read-only type/API compatibility checks or a disposable harness against the pinned Actor-Web revision where possible.
- Confirm no Ignite-specific topology wrapper, hardcoded transport fact, DOM lifecycle repair, or Ignite-owned simulation loop is required.
- Run fas validate-task for the Ignite validation artifact and verify any drafted Actor-Web follow-up graph separately in that repository.

## Risks

- A cross-repo validation can accidentally broaden into implementation or mutate Actor-Web source.
- Testing against an unpinned branch can make the adoption brief stale immediately.
- An Ignite workaround can conceal an Actor-Web source/read-model gap and corrupt ownership.

## Dependencies
- Depends on retained-canvas stress example task-1783719697500.
- Blocks scheduling-verdict task-1783719681572.
- Actor-Web remains a read-only downstream consumer for this task.

## Open questions
- Any remaining gap must be classified and queued in its owning repository; it must not be silently solved in the adoption brief.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
