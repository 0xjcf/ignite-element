# define v3 public API boundary and prevent internal API leaks

## Source

Created with `fas create-task` on 2026-05-27.

## Problem

Define the exact v3 stable public API allowlist for ignite-element, remove or quarantine internal config/renderer/factory exports from public entrypoints and package exports/typesVersions, add export-boundary snapshot coverage so internal APIs cannot leak again, and audit docs/examples so they only teach stable public APIs unless an advanced/unstable surface is explicitly labeled.

## Acceptance criteria

- Root ignite-element and adapter subpaths expose only the approved v3 stable public API such as igniteCore, event, required JSX runtime entrypoints, and intentional public types.
- Config, renderer registry, factory, global style mutation, source-internal renderer, and package-internal utility APIs are removed from stable public exports or moved behind an explicitly unstable/internal boundary.
- package.json exports and typesVersions match the public allowlist and do not publish deprecated config/plugin or renderer internals as stable v3 APIs.
- A focused export snapshot or equivalent boundary test fails when unexpected public keys/subpaths leak.
- Docs and examples are audited for public API exposure and updated to avoid recommending internal or deprecated APIs.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution

- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered

- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files

- packages/ignite-element/src/index.ts
- packages/ignite-element/package.json
- packages/ignite-element/src/xstate.ts
- packages/ignite-element/src/redux.ts
- packages/ignite-element/src/mobx.ts
- packages/ignite-element/src/actor-web.ts
- packages/ignite-element/src/renderers
- packages/ignite-core/src/index.ts
- packages/ignite-renderer/src/index.ts
- docs/site/src/content/docs

## Scope Amendments

- None.

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
