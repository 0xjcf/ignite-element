# V3 BETA: remove positional effects callback per docs/v3-api-consistency.md

## Source
Created with `fas create-task` on 2026-06-18.

## Problem
Remove the positional effects callback form for the v3 beta API. Object-form effects ({ snapshot, prevSnapshot, actor, emit, host, select }) are the only supported runtime and type surface. Delete the runtime Function.prototype.toString signature sniffing path, remove public positional effects support where the API allows, and update stale docs/readmes to object-form examples before v3 stable.


## Acceptance criteria
- Object-form effects callbacks are the only supported runtime invocation path.
- Public config/types no longer accept the positional effects(snapshot, prevSnapshot, context) callback form where this package owns the API surface.
- Runtime effects no longer use Function.prototype.toString or objectStyleCallbackPattern to detect callback shape.
- Stale docs/readmes/examples that still show positional effects are updated to object-form.
- Tests cover canonical object-form runtime behavior and compile-time rejection of positional effects.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-element/src/runtime/effects.ts
- packages/ignite-element/src/RenderArgs.ts
- packages/ignite-core/src/RenderArgs.ts
- .changeset/effects-object-form.md
- packages/ignite-element/src/igniteCore/types.ts
- packages/ignite-element/src/createProjectionFactory.ts
- packages/ignite-element/src/igniteCore/createIgniteComponentFactory.ts
- packages/ignite-core/src/index.ts
- packages/ignite-core/src/types.ts
- packages/ignite-adapters/src/types.ts
- packages/ignite-adapters/src/xstate.ts
- packages/ignite-element/src/tests/runtime-deprecations.test.ts
- packages/ignite-element/src/tests/types/igniteCore.types.test.ts
- docs/v3-api-consistency.md
- docs/api/README.md
- docs/testing.md
- packages/ignite-element/README.md
- docs/site/src/content/docs/api/ignite-core.mdx
- docs/site/src/content/docs/migration/effects-events.mdx
- docs/migrations/v2.2.3-effects-events.md
- README.md
- docs/v3-stable-roadmap.md

## Scope Amendments
- Type: scope-change
- Added at: 2026-07-05
- Trigger: owner-decision
- Reason: The owner chose v3 beta removal instead of a temporary deprecation because stable v3 has not shipped and object-form effects should be the only API before release.
- Added paths: packages/ignite-element/src/runtime/effects.ts, packages/ignite-element/src/RenderArgs.ts, packages/ignite-element/src/igniteCore/types.ts, packages/ignite-element/src/createProjectionFactory.ts, packages/ignite-element/src/igniteCore/createIgniteComponentFactory.ts, packages/ignite-core/src/RenderArgs.ts, packages/ignite-core/src/index.ts, packages/ignite-core/src/types.ts, packages/ignite-adapters/src/types.ts, packages/ignite-adapters/src/xstate.ts, packages/ignite-element/src/tests/runtime-deprecations.test.ts, packages/ignite-element/src/tests/types/igniteCore.types.test.ts, docs/v3-api-consistency.md, docs/api/README.md, docs/testing.md, packages/ignite-element/README.md, docs/site/src/content/docs/api/ignite-core.mdx, docs/site/src/content/docs/migration/effects-events.mdx, docs/migrations/v2.2.3-effects-events.md, .changeset/effects-object-form.md
- Evidence source: repo scan
- Evidence: repo scan | Most source examples and tests already use object-form effects; remaining positional usage is stale docs/readme content and one new deprecation test from the abandoned warning path.
- Accuracy signal: Dirty files and rg results identify runtime, public types, adapter config surfaces, tests, and stale docs that must move together.

- Type: scope-change
- Added at: 2026-07-05
- Trigger: owner-decision
- Reason: Owner requested stale docs/readme examples be moved to object-form and additive/deprecate wording be replaced with v3 beta removal.
- Added paths: README.md, docs/v3-stable-roadmap.md
- Evidence source: repo scan
- Evidence: repo scan | rg found positional effects examples in root README and additive/deprecate wording in roadmap/sequencing docs.
- Accuracy signal: Dirty docs paths match the requested object-form and beta-removal copy cleanup.

## Implementation plan
- Remove positional effects types/usages from core, adapters, and ignite-element config surfaces.
- Simplify attachEffects to invoke the object-form callback directly.
- Update stale documentation snippets to object-form examples.
- Add or update focused tests for object-form behavior and positional type rejection.

## Verification plan
- Run focused effects/runtime tests and affected package typechecks.
- Run fas validate-task before committing.
- Defer .fas/scripts/verify.sh --full and CodeRabbit review to the shared epic closeout lane.

## Risks
- This is a beta breaking change; users on positional effects must migrate before v3 stable.
- Removing compatibility types can expose stale internal docs or type tests that still reference the positional form.

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
