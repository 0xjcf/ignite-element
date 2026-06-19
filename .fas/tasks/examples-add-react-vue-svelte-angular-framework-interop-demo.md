# feat: ignite-element/react schema-driven React wrapper + registration handle + React demo

## Source
Created with `fas create-task` on 2026-06-18.

## Problem
Reshaped from the framework-interop gap-finder (was: hand-rolled React/Vue/Svelte/Angular demos). Per docs/ignite-react.md, ship the schema-driven approach. DELIVERABLES in order: (1) ADDITIVE igniteCore change — registration register(tagName, render) returns a typed IgniteComponent<Commands,Events> handle (was void) carrying tagName + getSchema() + phantom command/event types; sites: igniteCore/createIgniteComponentFactory.ts + igniteCore/types.ts. Non-breaking; also useful for the test DSL/agent surfaces. (2) ignite-element/react entrypoint — igniteReact(component) returns a typed forwardRef React component: commands -> ref API; single-arg setX -> props; events map -> on<Event> callback props receiving the flat event member; wires events via addEventListener from getSchema() with cleanup; reads component.tagName (NO tagName arg). Add the ./react export to package.json + build wiring; react is a peer of that entrypoint only. (3) React 19 demo under examples/frameworks/react consuming igniteReact — a small REAL feature, idiomatic React (no scattered refs/listeners), proving props-in + events-out + ref commands. (4) Tests for the handle + igniteReact (on* props fire with cleanup; ref commands; setX props). (5) Extend guides/host-app-integration.mdx (do not duplicate); briefly document the hand-rolled-wrapper fallback. (6) changeset (additive: ./react entrypoint + registration handle return). Hard part: the TS inference (Events->on* props, commands->ref, setX->props) — spike early. Vue/Svelte/Angular wrappers follow as separate tasks from the same handle/schema. Sequenced Phase 1: land the handle + helper before the breaking cutover so the demo showcases it. Design: docs/ignite-react.md.


## Acceptance criteria
- The new functionality works as described.
- Existing behavior is not broken.
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
- packages/ignite-element/src/igniteCore/createIgniteComponentFactory.ts
- packages/ignite-element/src/igniteCore/types.ts
- packages/ignite-element/src/react/index.ts
- packages/ignite-element/src/react/igniteReact.tsx
- packages/ignite-element/package.json
- packages/ignite-element/src/examples/frameworks/react/package.json
- packages/ignite-element/src/examples/frameworks/react/vite.config.ts
- packages/ignite-element/src/examples/frameworks/react/tsconfig.json
- packages/ignite-element/src/examples/frameworks/react/index.html
- packages/ignite-element/src/examples/frameworks/react/src/main.tsx
- packages/ignite-element/src/examples/frameworks/react/src/App.tsx
- packages/ignite-element/src/examples/frameworks/react/src/counter.ignite.tsx
- packages/ignite-element/src/examples/frameworks/react/README.md
- packages/ignite-element/src/tests/react/igniteReact.test.tsx
- docs/site/src/content/docs/guides/host-app-integration.mdx
- .changeset/ignite-react.md

## Scope Amendments
- Type: scope-refresh
- Added at: 2026-06-19
- Added paths: packages/ignite-element/src/examples/frameworks/react/package.json, packages/ignite-element/src/examples/frameworks/react/vite.config.ts, packages/ignite-element/src/examples/frameworks/react/tsconfig.json, packages/ignite-element/src/examples/frameworks/react/index.html, packages/ignite-element/src/examples/frameworks/react/src/main.tsx, packages/ignite-element/src/examples/frameworks/react/src/App.tsx, packages/ignite-element/src/examples/frameworks/react/README.md, packages/ignite-element/package.json, docs/site/src/content/docs/guides/host-app-integration.mdx

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
