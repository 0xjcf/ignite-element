# Command-source prerequisite migration ledger

This is the API prerequisite authorized on 2026-09-17, not acceptance of additional handbook pages.

## Parked documentation checkpoint

- Branch: `fas/docs-page-refinement`.
- Commit: `1cfc2310557e9ed602c6e7f9524e9827e45f4dbc`.
- Tree: `14689a7da715fa2cfde41745438f7485bbb34b5d`.
- Getting started remains Operator-approved at `7d8e37840bfacb2835bd2f99f2cab5b9e9558275`.
- Sources awaits review; Views is queued.
- No files or refs in that worktree changed during this prerequisite.

After API review, reconcile that branch onto the accepted implementation. Show changed code on previously accepted pages and rerun affected snippet checks before page acceptance. Keep the approved Starlight theme and prose treatment in that review branch.

## Mechanical migrations

Command callbacks now destructure `source`. Existing local `actor` names remain ordinary aliases where they reduce churn. Canonical XState uses `source` directly; canonical Redux and MobX use `source: store`.

The list includes current examples, checked consumer modules and their readers. Adding an unreleased note or pinning the published quickstart is a version-coherence change, not a broader page rewrite.

- `README.md`
- `docs/accessibility-by-default.md`
- `docs/can-execute.md`
- `docs/core-api-bindings.md`
- `docs/site/src/content/docs/api/command-metadata.mdx`
- `docs/site/src/content/docs/api/headless-runtime.mdx`
- `docs/site/src/content/docs/guides/accessibility-first.mdx`
- `docs/site/src/content/docs/guides/actor-web.mdx`
- `docs/site/src/content/docs/guides/agent-runtime-v3.mdx`
- `docs/site/src/content/docs/guides/plain-controllers.mdx`
- `docs/site/src/content/docs/guides/routing.mdx`
- `docs/site/src/content/docs/guides/shared-source-ownership.mdx`
- `docs/site/src/content/docs/handbook/api.mdx`
- `docs/site/src/content/docs/handbook/events.mdx`
- `docs/site/src/content/docs/handbook/sources.mdx`
- `docs/site/src/content/docs/handbook/testing.mdx`
- `docs/site/src/content/docs/handbook/views.mdx`
- `docs/site/src/content/docs/index.mdx`
- `docs/site/src/content/docs/migration/command-source.mdx`
- `docs/site/src/content/docs/migration/effects-events.mdx`
- `examples/adapters/mobx/README.md`
- `examples/adapters/mobx/mobxExample.ts`
- `examples/adapters/redux/README.md`
- `examples/adapters/redux/src/js/reduxExample.tsx`
- `examples/adapters/xstate/README.md`
- `examples/adapters/xstate/event-counter.ts`
- `examples/adapters/xstate/shared-counter.tsx`
- `examples/adapters/xstate/shared-session-view.tsx`
- `examples/adapters/xstate/xstateAgentRuntimeShowcase.tsx`
- `examples/adapters/xstate/xstateApiShowcaseRuntime.ts`
- `examples/adapters/xstate/xstateExample.tsx`
- `examples/adapters/xstate/xstateTaskManager.ts`
- `examples/agents/smart-home/src/home.ts`
- `examples/agents/voice-workbench/src/workbench-component.ts`
- `examples/apps/dashboard-with-shared-state/src/dashboard.headless.test.ts`
- `examples/apps/dashboard-with-shared-state/src/dashboard.tsx`
- `examples/apps/form-with-validation/src/form.headless.test.ts`
- `examples/apps/form-with-validation/src/form.tsx`
- `examples/apps/nested-child-router/src/router.headless.test.ts`
- `examples/apps/nested-child-router/src/router.tsx`
- `examples/apps/spa-router/README.md`
- `examples/apps/spa-router/src/pages.tsx`
- `examples/apps/spa-router/src/router.headless.test.ts`
- `examples/apps/spa-router/src/router.tsx`
- `examples/frameworks/react/counter-core.ts`
- `examples/frameworks/react/src/counter.ignite.tsx`
- `examples/frameworks/svelte/src/stepper.ignite.ts`
- `examples/frameworks/vue/src/toggle.ignite.ts`
- `packages/ignite-element/README.md`
- `scripts/__tests__/fixtures/authentic-actor-web-core.mjs`
- `scripts/__tests__/fixtures/authentic-actor-web-core.ts`
- `scripts/__tests__/fixtures/docs-check-redux.ts`
- `scripts/__tests__/fixtures/event-contract.tsx`
- `scripts/__tests__/fixtures/handbook/beta14-toggle.tsx`
- `scripts/__tests__/fixtures/handbook/mobx.ts`
- `scripts/__tests__/fixtures/handbook/redux.ts`
- `scripts/__tests__/fixtures/handbook/toggle.tsx`
- `scripts/__tests__/fixtures/headless-dom-probe.mjs`
- `scripts/__tests__/fixtures/native-events-dom.tsx`
- `scripts/__tests__/fixtures/neutral-actor-web.ts`
- `scripts/__tests__/fixtures/neutral-mobx.ts`
- `scripts/__tests__/fixtures/neutral-react.ts`
- `scripts/__tests__/fixtures/neutral-redux.ts`
- `scripts/__tests__/fixtures/neutral-xstate.ts`
- `scripts/__tests__/fixtures/react-native-bindings/bindings.native.js`
- `scripts/__tests__/fixtures/react-native-bindings/consumer.tsx`
- `scripts/__tests__/fixtures/source-free-adapters.tsx`

## Intentionally retained old spelling

The root and facade README quickstarts and `scripts/__tests__/fixtures/handbook/beta14-toggle.tsx` use published beta.14. Getting started embeds that same source. The strict published consumer compiles and executes it against registry beta.14; candidate consumers use the separate migrated fixture.

The command-source migration shows the old spelling in diff removals. Historical command-emission examples and codemod inputs retain their old callback. Negative type tests retain invalid `{ actor }` to prove removal. Archived v2 pages, historical release/review records and design proposals remain unchanged.

The agent export labels candidate syntax as unavailable in beta.14 and preserves the explicitly versioned Getting started exception. This candidate is not deployed.

## Downstream migration

Feeling and other consumers should change `{ actor }` to `{ source: actor }`, or use `{ source }` and rename the local references. Redux and MobX may use `{ source: store }`. No additional wrapper, actor runtime or configuration option is needed.

Configuration `source` still accepts supported instances, factories or definitions. Callback `source` is the resolved active command interface. Preserve command bodies, source construction, native shutdown, subscriptions and ownership. Do not upgrade public install examples to this syntax until a supporting beta has been published and verified.
