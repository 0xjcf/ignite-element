# reconcile actor-web branded ActorAddress via tolerant ActorWebAddress union + remove commandSource and ActorWebSourceHandle to unify the actor-web adapter config surface with the other adapters; cut ignite beta.8

## Source
Created with `fas create-task` on 2026-06-23.

## Problem
reconcile actor-web branded ActorAddress via tolerant ActorWebAddress union + remove commandSource and ActorWebSourceHandle to unify the actor-web adapter config surface with the other adapters; cut ignite beta.8

**Full root-cause + validation context** lives in the originating cross-repo brief:
`.fas/tasks/actor-web-reconcile-ignite-actorweb-loose-contract-with-acto.md` (queued task-1782143407138).
This direct task implements its amended scope. Two independent fixes ship in one beta.8:
1. **Address contract (FIX 1):** actor-web's canonical `ActorAddress` became an opaque branded `string`.
   ignite's loose `ActorWebAddress` (object) no longer accepts it. Fix = tolerant union
   `string | { id; path; type?; node? }` (green vs installed `@actor-web/runtime@0.1.0` object AND the new
   branded-string runtime; `// TODO(actor-web > 0.1.0): collapse to string` once actor-web publishes + ignite
   bumps the dep). Address is pass-through only (verified — no `.id`/`.path`/`.node` reads), so the union and
   the eventual pure `string` are both no-ops for ignite logic.
2. **Unify the surface (FIX 2, owner-directed):** remove `commandSource` + `ActorWebSourceHandle` entirely so
   every adapter shares one config surface (`{ source, view, commands, effects, events }`). The command actor
   derives only from `source` (writable iff it exposes `send`). The original "restore the regressed `states`
   alias" approach is WITHDRAWN (the `states`→`view` rename stays complete).

## Acceptance criteria
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Establish the intended approach at a design level before editing code.

## Alternatives considered
- None recorded yet.

## Affected files
- packages/ignite-adapters/src/adapters/ActorWebAdapter.ts
- packages/ignite-adapters/src/actor-web.ts
- packages/ignite-adapters/src/index.ts
- packages/ignite-adapters/src/__tests__/actor-web-canonical-compat.types.ts
- packages/ignite-element/src/igniteCore/types.ts
- packages/ignite-element/src/igniteCore/actor-web.ts
- packages/ignite-element/src/actor-web.ts
- packages/ignite-element/src/IgniteCore.ts
- packages/ignite-element/src/tests/adapters/ActorWebAdapter.test.ts
- packages/ignite-element/src/tests/IgniteCore.test.ts
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- docs/site/src/content/docs/guides/actor-web.mdx
- docs/v3-api-consistency.md
- packages/ignite-element/README.md
- .changeset/actorweb-opaque-address-unify-surface.md

## Scope Amendments
- None.

## Implementation plan
- Build the implementation plan during task planning.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Identify regression, rollout, or coordination risks during planning.

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
