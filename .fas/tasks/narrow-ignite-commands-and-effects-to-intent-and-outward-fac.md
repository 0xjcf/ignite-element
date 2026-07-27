# Narrow Ignite commands and effects to intent and outward-fact callbacks

## Source

Created with `fas create-task` on 2026-07-24.

## Problem

Apply the architecture standard to the pre-stable public callback contract. Commands receive only the adapter-native actor and command metadata helper and express public intent. Effects receive snapshot, prevSnapshot, select, and emit; they remain synchronous transition-to-public-fact bridges and do not receive actor or host. Keep the actual DOM or headless host internal for CustomEvent dispatch and error reporting. Remove promise-returning effect semantics, migrate real examples and docs, preserve source-emitted event bridges, and provide a coordinated beta migration note and changeset.

## Acceptance criteria

- CommandContext no longer exposes host and all public types, overloads, tests, examples, and docs compile against actor plus command only.
- EffectContext no longer exposes actor or host and effect callbacks return void rather than promise-like work.
- Internal DOM and EventTarget hosts continue to dispatch typed events and route errors without becoming public mutation capabilities.
- XState and Actor-Web emitted facts remain preferred when sources emit natively; Redux and MobX transition-to-event effects remain supported.
- Headless Node tests prove the same callback contract without document, HTMLElement, browser globals, or retained resources.
- A breaking beta changeset and migration table cover every source, docs, test, and example update in one coordinated cutover.
- TDD: a failing test that captures the new or changed behavior is written before the implementation and lands in the same change.
- TDD: every production code change in the change set is covered by an added or updated test.
- DDD: respect domain boundaries — keep the functional core deterministic and side-effect-free (no reads, writes, network, or clock), confine coordination to the imperative shell, and have adapters return facts instead of throwing.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution

- Change the public command context to `{ actor, command }`, where `actor` is the adapter-native intent target and `command` is metadata only. Remove `host` from all command overloads and public projections.
- Change the public effect context to `{ snapshot, prevSnapshot, select, emit }` and require a `void` return. Remove `actor`, `host`, and promise-like results while preserving change filtering and typed outward event emission.
- Keep DOM `CustomEvent` dispatch, headless `EventTarget` dispatch, and runtime error routing inside the projection/runtime implementation; these internals may hold the host but do not expose it as a consumer capability.
- Ship the type change, runtime behavior, examples, migration table, and beta changeset as one coordinated cutover so no supported surface teaches the old callback contract.

## Alternatives considered

- Keep `host` as a deprecated callback property: rejected because deprecated access would preserve the architectural escape hatch throughout the beta and continue producing new host-coupled code.
- Narrow `host` to `HTMLElement` or `EventTarget`: rejected because the problem is mutation authority, not the precision of the host type.
- Keep `actor` or async work in effects: rejected because feedback belongs in source-native actions, actors, thunks, or store methods where success, failure, cancellation, and cleanup can re-enter as explicit facts.
- Add a replacement host API in the same change: rejected unless a real migration case cannot be expressed through source provisioning, outward events, or retained presentation callbacks.

## Affected files

- packages/ignite-core/src/RenderArgs.ts
- packages/ignite-element/src/createProjectionFactory.ts
- packages/ignite-element/src/runtime/effects.ts
- packages/ignite-element/src/igniteCore
- packages/ignite-element/src/tests
- README.md
- packages/ignite-element/README.md
- docs/site/src/content/docs

## Scope Amendments

- None.

## Implementation plan

- Write failing public type and headless tests that reject host in commands, actor or host in effects, and promise-returning effects while preserving emit, select, snapshot, and prevSnapshot.
- Narrow RenderArgs and projection assembly types, retain host-only internal event dispatch and error routing, and migrate package tests and real examples in one coordinated beta cutover.
- Update current API docs and migration notes, add changesets, and verify source-emitted events and Redux or MobX effect bridges remain intact.

## Verification plan

- Run focused core type tests, effect runtime tests, emitted-event bridge tests, and pure-Node headless tests.
- Run package typechecks, example typechecks, docs code-example checks, and export verification.
- Run fas validate-task and full verification because this is a pre-stable shared public contract change.

## Risks

- Removing actor from effects may expose undocumented consumers that use effects as a feedback loop.
- Internal host error handling could accidentally be removed along with the public host property.
- A partial docs or example migration would leave conflicting stable guidance.

## Dependencies

- Depends on task-1784909239951 architecture standard.
- Blocks task-1784909335843 conformance and public API verdict.

## Open questions

- None; any newly discovered legitimate host mutation use case must return to architecture rather than reintroducing the generic escape hatch during implementation.

## Artifact links

- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`
