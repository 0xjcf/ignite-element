# examples/frameworks: Vue interop demo — consume an ignite element via standard custom-element APIs (isCustomElement)

## Source
Created with `fas create-task` on 2026-06-19.

## Problem
Build a runnable Vue 3 demo under packages/ignite-element/src/examples/frameworks/vue, mirroring the react example vite + source-alias scaffolding (alias ignite-element and the scoped @ignite-element packages to local source; pin xstate to the workspace version). Consume a small ignite element via Vue standard custom-element path: set compilerOptions.isCustomElement through the Vue vite plugin so Vue treats the ignite tag as a custom element; pass props and attributes in; receive CustomEvents via @event listeners (plus a template ref and addEventListener for command methods). Document the real Vue friction honestly (isCustomElement config, string-attribute coercion, event-name casing, property vs attribute binding) and do not paper over it. Do NOT build an igniteVue helper: per-framework wrappers stay follow-ups (see the v3-examples-track memory). This demo backs the multi-framework doc claims (guides/index, host-app-integration Vue block, what-is-ignite-element) and acts as an API gap-finder before the breaking cutover, exactly as the react demo surfaced IgniteReactRef and lit auto-detect. Capture any API gaps as follow-up task briefs BEFORE any source change. Keep the demo minimal and headless-testable; add the new example tsconfig to the packages/ignite-element package.json typecheck chain; extend (do not duplicate) the host-app-integration Vue section if needed. Precedent: docs/ignite-react.md and the react example. FIRST of the LOCKED sequence Vue then Svelte then Angular then worked-apps (docs/v3-stable-roadmap.md).

## Acceptance criteria
- The change is verified and does not introduce regressions.
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
- packages/ignite-element/src/examples/frameworks/vue/package.json
- packages/ignite-element/src/examples/frameworks/vue/vite.config.ts
- packages/ignite-element/src/examples/frameworks/vue/tsconfig.json
- packages/ignite-element/src/examples/frameworks/vue/index.html
- packages/ignite-element/src/examples/frameworks/vue/src/main.ts
- packages/ignite-element/src/examples/frameworks/vue/src/App.vue
- packages/ignite-element/src/examples/frameworks/vue/src/counter.ignite.ts
- packages/ignite-element/src/examples/frameworks/vue/README.md
- packages/ignite-element/package.json
- docs/site/src/content/docs/guides/host-app-integration.mdx

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
