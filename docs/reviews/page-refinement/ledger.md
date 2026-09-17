# Documentation refinement ledger

Started at beta `cd40ce117cf5a2a3be92415ba7e02bd99e45d969`, tree `632410b8b74284cd8588fbaca58d001c96d13014` (same as both 2026-09-16 audits). This is the historical audit baseline; the API reconciliation below records the current candidate.

This ledger carries all A01–A12 and E01–E10 findings from the supplied audits. Findings outside the current slice are queued reports, not newly verified conclusions. Shared presentation affects all routes; it does not confer content acceptance. Getting started is accepted by the Operator at `7d8e37840bfacb2835bd2f99f2cab5b9e9558275`; no other page is accepted. Review order: Getting started, Sources, Views, Events, Ownership, Testing, API, Examples, then remaining destinations individually. Prior review records remain historical.

Current slice: shared editorial consistency across current pages, with Getting started still the next acceptance checkpoint. The parked branch stays unchanged at `1cfc2310557e9ed602c6e7f9524e9827e45f4dbc`, tree `14689a7da715fa2cfde41745438f7485bbb34b5d`. Its original Getting started approval remains historical evidence. The local successor `fas/docs-getting-started-source` includes integrated beta `af0de5696b60922aacbbcc895879adcc72851357`; see the [factory reconciliation and Getting started re-review receipt](getting-started-factory-reconciliation.md). Getting started now awaits re-review. Sources still awaits review and Views remains queued. The accepted shared presentation is preserved. The Operator has authorized the shared prose pass below; individual page acceptance remains sequential.

## Code-block consistency — 2026-09-17

The Operator requested a second code-block pass after spotting nested actor/machine creation in Views. The [code-block receipt](code-block-consistency.md) records the named-machine simplification in React, Testing and shared-source cleanup, plus strict packed consumer verification. Page checkpoints are unchanged.

## Configuration guidance cleanup — 2026-09-17

The Operator requested removing legacy setup reminders from Views and checking related pages. The [configuration cleanup receipt](configuration-guidance-cleanup.md) records the v2 migration instructions, retained optional renderer API, linked README cleanup and validation. Getting started awaits re-review; Sources awaits review; Views remains queued.

## Per-element source clarity — 2026-09-17

The Operator requested copyable, unambiguous source examples. Sources now leads with the XState machine / Redux slice / fresh MobX observable factory mapping. The optional Redux factory remains available for custom store configuration. The [clarity receipt](source-input-clarity.md) records strict packed compilation and two-element independence checks for the actual displayed modules, including manual browser verification. Page approvals are unchanged.

## Shared examples moved out of Sources — 2026-09-17

The Operator requested keeping full shared-source examples in the shared-source guide. Sources now focuses on per-element factories and links to each sharing example. The [relocation receipt](sources-shared-examples.md) records the preserved canonical modules, updated Testing link and validation. Page checkpoints remain unchanged.

## Shared editorial consistency — 2026-09-17

The Operator requested short sentences, one idea per paragraph and scannable headings across current pages before continuing individual reviews. The [editorial receipt](editorial-consistency.md) records the 20-page prose pass, removal of unnecessary adapter-property explanations, preserved examples and anchors, and fresh documentation validation. This supersedes the earlier restriction on editing later-page prose for this bounded pass only. Getting started awaits re-review; Sources awaits review; Views remains queued. No page acceptance has advanced.

## Factory reconciliation and Getting started re-review — 2026-09-17

The Operator authorized integrating the merged MobX/Redux factory refinement while preserving the editorial candidate. Local merge `06f18ee49b6959d158572699016bf417ff22ea8a` carries the accepted package changes and checked factory guidance forward. Getting started and its `{ source }` light-switch example are unchanged and freshly validated against packed candidate packages. See the [re-review receipt](getting-started-factory-reconciliation.md). Only Getting started is returned for acceptance; Sources awaits review and Views remains queued.

## Command wording and beta-history audit — 2026-09-17

The Operator requested another audit after finding stale MobX prose. The [audit receipt](command-wording-beta-history-audit.md) records narrow command-context and release-label corrections across Sources and its related references. These corrections do not accept Sources or advance the page review. Getting started remains awaiting re-review; Sources remains awaiting review; Views remains queued. The proposed separation of beta release notes from the v2-to-v3 upgrade guide is awaiting a product decision.

## Publication-copy preview — 2026-09-17

The Operator requested the wording readers will see after the supporting beta is released. This supersedes temporary unreleased notices in the learner-facing candidate. The [publication-copy receipt](publication-copy-preview.md) records the beta install/download changes and remaining release verification. This local preview does not establish publication or authorize deployment. Getting started awaits re-review; Sources awaits review; Views remains queued.

## Current API without beta migration notes — 2026-09-17

The Operator approved removing beta-to-beta instructions and checking the other pages. The [cleanup receipt](current-api-without-beta-history.md) records current-contract wording, redirects for retired beta notes, and a stable-source-grounded v2 upgrade guide. Earlier proposed Release notes navigation is no longer planned; package changelogs retain release history. Page checkpoints remain unchanged.

## Documented source scope — 2026-09-17

The Operator deferred public Actor-Web guidance and examples. Current documentation now teaches XState, Redux, and MobX. The [scope receipt](three-source-documentation-scope.md) records removed guide promotion, the dependent plain-controller recipe, current-reference/README cleanup, and retained implementation/testing boundaries. Existing page-review checkpoints remain unchanged.

## Pages

Source paths below are relative to `docs/site/src/content/docs/`. All pages inherit A06–A09 presentation validation; archive content retains its historical API.

| Page / URL | Findings | Source | Status | Evidence / remaining work |
| --- | --- | --- | --- | --- |
| [Getting started](https://0xjcf.github.io/ignite-element/) | A01, A08, A10 | `index.mdx` | awaiting re-review | Original approval at `7d8e3784` preserved; current candidate validation and preview in the [re-review receipt](getting-started-factory-reconciliation.md). |
| [Sources](https://0xjcf.github.io/ignite-element/handbook/sources/) | A01, A08 | `handbook/sources.mdx` | awaiting review | Adapter-specific states inputs, short paragraphs, installation blocks, checked Redux/MobX modules and discoverable guides; [receipt](sources.md). |
| [Views](https://0xjcf.github.io/ignite-element/handbook/views/) | A08, A11 | `handbook/views.mdx` | queued | Show const ctx = useIgnite(core) and the small view first. Link the shared source definition rather than front-loading a 43-line setup. Clearly separate the neutral hook from browser custom-element interoperability. |
| [Events & effects](https://0xjcf.github.io/ignite-element/handbook/events/) | A11 | `handbook/events.mdx` | queued | Lead with when to forward a source event and when to derive a notification. Keep one producer per event and core/source ownership explicit. Move detailed ordering, activation and error contracts to a reference section, preserving links. |
| [Ownership & cleanup](https://0xjcf.github.io/ignite-element/handbook/ownership/) | A08, A11 | `handbook/ownership.mdx` | queued | Lead with who creates and stops the source. Add a short, labeled cleanup example; keep isolated-source and failure-cleanup details as reference. Do not remove required borrowed-source cleanup. |
| [Testing](https://0xjcf.github.io/ignite-element/handbook/testing/) | A10 | `handbook/testing.mdx` | queued | Keep source, core and view tests separate. Make setup/import dependencies explicit and format snippets consistently. Preserve behavioral assertions. |
| [API reference](https://0xjcf.github.io/ignite-element/handbook/api/) | A08, A09 | `handbook/api.mdx` | queued | Keep the compact lookup table, but put long signatures in formatted blocks. Preserve the distinction between common configuration shape and actual adapter-specific TypeScript overloads. |
| [Examples](https://0xjcf.github.io/ignite-element/handbook/examples/) | A09, A11 | `handbook/examples.mdx` | queued | Fix the empty strip inside the table border. Put the run instructions before the catalogue; distinguish runnable projects from documentation recipes. |
| [Migrate from v2 to v3 (beta)](https://0xjcf.github.io/ignite-element/migration/v3/) | A01, A04, A11 | `migration/v3.mdx` | queued | Replace the “APIs are stable” reassurance with an honest beta compatibility statement. Separate v2 migration from beta-to-beta history. Trim publication chronology and use adapter-neutral terminology. |
| [Migrate command emission](https://0xjcf.github.io/ignite-element/migration/effects-events/) | A10 | `migration/effects-events.mdx` | queued | Keep historical and current examples clearly labeled. Align the page title with the navigation label and format the cleanup example consistently. |
| [Shared readiness and terminal disposal](https://0xjcf.github.io/ignite-element/migration/shared-readiness-terminal-disposal/) | A04 | `migration/shared-readiness-terminal-disposal.mdx` | queued | Explicitly label the per-host effects paragraph as beta.13 history and link beta.14 semantics beside it. Do not combine a moving @beta install recommendation with unqualified older effects behavior. |
| [Testing API migration](https://0xjcf.github.io/ignite-element/api/testing-dsl/) | A11 | `api/testing-dsl.mdx` | queued | Retain the retirement notice and replacements. Shorten the list of removed internal type counts; prioritize what users should write now. |
| [Migrate from v1 to v2](https://0xjcf.github.io/ignite-element/migration/v2/) | A04 | `migration/v2.mdx` | queued | Label the whole page as v1-to-v2 historical guidance despite the v3 shell. Reconcile its differing cleanup guidance with the versioned v2 migration page against the actual v2 release. |
| [Ignite Element](https://0xjcf.github.io/ignite-element/2.x/) | A12 | `2.x/index.mdx` | queued | Preserve v2 identity and API examples. The live bundle-size badge reports an upstream rate limit. Check the contradictory renderer description against v2.2.2 before changing historical guidance. |
| [Compatibility](https://0xjcf.github.io/ignite-element/api/compatibility/) | A04, A09 | `api/compatibility.mdx` | queued | Separate the current beta.14 compatibility matrix from beta.13 historical validation notes. Retain actual NodeNext and native compatibility limits; fix table border/row width mismatch. |
| [Support & links](https://0xjcf.github.io/ignite-element/community/) | A12 | `community/index.mdx` | queued | Keep the short page. Link examples and changelog directly rather than leaving repository paths as inline code. Shared footer link styling corrected in the first-page theme slice; this page’s content review remains queued. |
| [Actor-Web adapter](https://0xjcf.github.io/ignite-element/guides/actor-web/) | A01, A03, A05 | `guides/actor-web.mdx` | queued | Correct the read-only command-dispatch claim; distinguish runtime event capability from TypeScript declarations. Move home.dispose() into guaranteed cleanup. Shorten the topology material and link the full example. |
| [Advanced plain-controller interoperability](https://0xjcf.github.io/ignite-element/guides/plain-controllers/) | A05, A10, A11 | `guides/plain-controllers.mdx` | queued | Keep this explicitly optional advanced interoperability. Review the preparation-only get("states") block and owner wrapper against beta.14; simplify the canonical example without losing cleanup/error handling. Prefer ctx in views. |
| [Accessibility first](https://0xjcf.github.io/ignite-element/guides/accessibility-first/) | A02, A05, A11 | `guides/accessibility-first.mdx` | queued | Remove the unsupported schema.commands.saveTarget.description example and inferred command-metadata claims. Correct the availability/execute explanation. Lead with native markup, labels and source guards; move agent/speech detail out of the main accessibility path. |
| [Advanced config](https://0xjcf.github.io/ignite-element/api/advanced-config/) | A08, A10 | `api/advanced-config.mdx` | queued | Label incomplete snippets and define their prerequisites. Shorten inline configuration fragments. Make the Lit example destination specific; the general Views page is not a full Lit setup guide. |
| [Share a source and own its lifetime](https://0xjcf.github.io/ignite-element/guides/shared-source-ownership/) | A01, A10, A11 | `guides/shared-source-ownership.mdx` | queued | Use the simple model and keep the small two-view example. Link the long account/receipt machine instead of embedding 159 lines. Preserve actual lifetime semantics and remove release-correction narration. |
| [Headless runtime](https://0xjcf.github.io/ignite-element/api/headless-runtime/) | A01, A10 | `api/headless-runtime.mdx` | queued | Use adapter-neutral wording. Define counterMachine or clearly mark the first snippet as a fragment. Scope preparation-read guidance to isolated acquisition; retain exact runtime contracts. |
| [Commands and tool schemas](https://0xjcf.github.io/ignite-element/api/command-metadata/) | A10, A11 | `api/command-metadata.mdx` | queued | The catalogue/tool-schema distinction is useful and should be canonical. Lead with current usage, label the initial fragment, and reduce the removed-API preamble. |
| [Historical bundle measurements](https://0xjcf.github.io/ignite-element/overview/bundle-size/) | A09 | `overview/bundle-size.mdx` | queued | The historical measurement label is correct. Keep it secondary, fix table width styling, and do not relabel the numbers as beta.14 measurements without measuring that release. |
| [Routing](https://0xjcf.github.io/ignite-element/guides/routing/) | A10, A11 | `guides/routing.mdx` | queued | Keep app-owned routing and guaranteed cleanup. Format the route union and long object literals; link the full projects and shorten repeated ownership explanation. |
| [Build for agents](https://0xjcf.github.io/ignite-element/guides/agent-runtime-v3/) | A02, A05, A10 | `guides/agent-runtime-v3.mdx` | queued | Align offered tool commands with the actual counter commands; renamePreset is offered without appearing in the example core. Define counterMachine/test setup or label fragments. Label the rendered range input and prefer ctx. |
| [What is Ignite Element?](https://0xjcf.github.io/ignite-element/2.x/overview/what-is-ignite-element/) | A12 | `2.x/overview/what-is-ignite-element.mdx` | queued | Retain the v2 banner and concise overview. Apply shared visual fixes only; use version-pinned supporting references. |
| [Installation](https://0xjcf.github.io/ignite-element/2.x/getting-started/installation/) | A10, A12 | `2.x/getting-started/installation.mdx` | queued | Retain v2-specific installation. Check whether optional configuration is presented as mandatory against v2.2.2; do not infer the answer from v3. Keep file labels and formatting consistent. |
| [Your first component](https://0xjcf.github.io/ignite-element/2.x/getting-started/first-component/) | A10, A12 | `2.x/getting-started/first-component.mdx` | queued | Preserve the historical API. Mark file boundaries and imports clearly and apply shared code formatting; maintain the v2 banner. |
| [Project setup](https://0xjcf.github.io/ignite-element/2.x/getting-started/project-setup/) | A08, A12 | `2.x/getting-started/project-setup.mdx` | queued | Break up long inline JSX/tool configuration strings. Preserve the version-specific plugin guidance until checked against v2.2.2. |
| [State adapters](https://0xjcf.github.io/ignite-element/2.x/concepts/state-adapters/) | A12 | `2.x/concepts/state-adapters.mdx` | queued | The cleanup explanations are internally difficult to reconcile. Verify shared/isolated ownership and defaults against v2.2.2, then correct the archive in a bounded pass. |
| [Renderers](https://0xjcf.github.io/ignite-element/2.x/concepts/renderers/) | A10, A12 | `2.x/concepts/renderers.mdx` | queued | Keep renderer examples versioned and clearly label their assumed component definition. Do not substitute v3 configuration behavior into the archive. |
| [Events & commands](https://0xjcf.github.io/ignite-element/2.x/concepts/events-and-commands/) | A12 | `2.x/concepts/events-and-commands.mdx` | queued | The commands emit example is historical v2 material, not a beta.14 regression. Preserve that boundary and verify changes against the archived release. |
| [Configuration](https://0xjcf.github.io/ignite-element/2.x/concepts/configuration/) | A10, A12 | `2.x/concepts/configuration.mdx` | queued | Preserve the v2 configuration entrypoint and plugin behavior. Apply code and shared layout polish only unless v2 validation proves a correction. |
| [igniteCore](https://0xjcf.github.io/ignite-element/2.x/api/ignite-core/) | A12 | `2.x/api/ignite-core.mdx` | queued | Its cleanup:true default conflicts with other retained guidance. Resolve from v2.2.2 implementation/tests; do not use the current beta default as evidence. |
| [defineIgniteConfig](https://0xjcf.github.io/ignite-element/2.x/api/define-ignite-config/) | A08, A10 | `2.x/api/define-ignite-config.mdx` | queued | Keep the archived API reference. Format long option shapes and label complete versus partial configuration examples. |
| [Renderers & strategies](https://0xjcf.github.io/ignite-element/2.x/api/renderers/) | A08, A10 | `2.x/api/renderers.mdx` | queued | Keep the archive banner and renderer-specific material. Format long loader/path references and identify fragment prerequisites. |
| [Styling](https://0xjcf.github.io/ignite-element/2.x/guides/styling/) | A12 | `2.x/guides/styling.mdx` | queued | Keep concise styling guidance. Replace the open-ended “while we expand this guide” promise with a stable, version-appropriate reference. |
| [Testing](https://0xjcf.github.io/ignite-element/2.x/guides/testing/) | A10, A12 | `2.x/guides/testing.mdx` | queued | The setup code block contains setup.ts and vitest.config.ts under one file label; split it into separate labeled files and include required imports. |
| [Tooling & bundlers](https://0xjcf.github.io/ignite-element/2.x/guides/tooling/) | A08, A12 | `2.x/guides/tooling.mdx` | queued | Shorten inline import/config strings and replace the stale promise to expand wrapper guidance with a version-appropriate link. |
| [Migrate from v1 to v2](https://0xjcf.github.io/ignite-element/2.x/migration/v2/) | A10, A12 | `2.x/migration/v2.mdx` | queued | Reconcile cleanup behavior with /migration/v2/ using v2 evidence. Render the checklist as proper tasks or ordinary bullets rather than literal [ ] text. |
| [Support & links](https://0xjcf.github.io/ignite-element/2.x/community/) | A12 | `2.x/community/index.mdx` | queued | Link an actual version-appropriate example directory instead of an unlinked src/examples/* reference. Apply shared footer/link styling. |
| [Validate the shared-controller recipe](https://0xjcf.github.io/ignite-element/contributing/shared-controller-validation/) | A04, A11 | `contributing/shared-controller-validation.mdx` | queued | Retain contributor validation steps and tested environment limits. Move release approval/custody narration to release records; clarify the historical beta.12 evidence boundary. |
| [404](https://0xjcf.github.io/ignite-element/404.html) | A12 | `404.md` | queued | Distinct recovery destinations. |

## Legacy destinations

Each legacy route remains queued for final integrated navigation acceptance. Existing route/fragment checks are reused per slice. Source: `docs/site/src/route-map.json`, `route-map.mjs`, `components/LegacyRoute.astro`, and matching route MDX files.

| Old URL | Destination | Findings | Status |
| --- | --- | --- | --- |
| [overview/what-is-ignite-element/](https://0xjcf.github.io/ignite-element/overview/what-is-ignite-element/) | [(root)](https://0xjcf.github.io/ignite-element/) | A06–A12; preserve subjects/anchors | queued |
| [getting-started/installation/](https://0xjcf.github.io/ignite-element/getting-started/installation/) | [(root)](https://0xjcf.github.io/ignite-element/) | A06–A12; preserve subjects/anchors | queued |
| [getting-started/first-component/](https://0xjcf.github.io/ignite-element/getting-started/first-component/) | [(root)](https://0xjcf.github.io/ignite-element/) | A06–A12; preserve subjects/anchors | queued |
| [getting-started/project-setup/](https://0xjcf.github.io/ignite-element/getting-started/project-setup/) | [(root)](https://0xjcf.github.io/ignite-element/) | A06–A12; preserve subjects/anchors | queued |
| [concepts/state-adapters/](https://0xjcf.github.io/ignite-element/concepts/state-adapters/) | [handbook/sources/](https://0xjcf.github.io/ignite-element/handbook/sources/) | A06–A12; preserve subjects/anchors | queued |
| [concepts/renderers/](https://0xjcf.github.io/ignite-element/concepts/renderers/) | [handbook/views/](https://0xjcf.github.io/ignite-element/handbook/views/) | A06–A12; preserve subjects/anchors | queued |
| [concepts/events-and-commands/](https://0xjcf.github.io/ignite-element/concepts/events-and-commands/) | [handbook/events/](https://0xjcf.github.io/ignite-element/handbook/events/) | A06–A12; preserve subjects/anchors | queued |
| [concepts/configuration/](https://0xjcf.github.io/ignite-element/concepts/configuration/) | [api/advanced-config/](https://0xjcf.github.io/ignite-element/api/advanced-config/) | A06–A12; preserve subjects/anchors | queued |
| [api/ignite-core/](https://0xjcf.github.io/ignite-element/api/ignite-core/) | [handbook/api/](https://0xjcf.github.io/ignite-element/handbook/api/) | A06–A12; preserve subjects/anchors | queued |
| [api/define-ignite-config/](https://0xjcf.github.io/ignite-element/api/define-ignite-config/) | [api/advanced-config/](https://0xjcf.github.io/ignite-element/api/advanced-config/) | A06–A12; preserve subjects/anchors | queued |
| [api/renderers/](https://0xjcf.github.io/ignite-element/api/renderers/) | [handbook/views/](https://0xjcf.github.io/ignite-element/handbook/views/) | A06–A12; preserve subjects/anchors | queued |
| [guides/styling/](https://0xjcf.github.io/ignite-element/guides/styling/) | [handbook/views/](https://0xjcf.github.io/ignite-element/handbook/views/) | A06–A12; preserve subjects/anchors | queued |
| [guides/testing/](https://0xjcf.github.io/ignite-element/guides/testing/) | [handbook/testing/](https://0xjcf.github.io/ignite-element/handbook/testing/) | A06–A12; preserve subjects/anchors | queued |
| [guides/tooling/](https://0xjcf.github.io/ignite-element/guides/tooling/) | [api/advanced-config/](https://0xjcf.github.io/ignite-element/api/advanced-config/) | A06–A12; preserve subjects/anchors | queued |
| [overview/when-to-choose-ignite/](https://0xjcf.github.io/ignite-element/overview/when-to-choose-ignite/) | [api/compatibility/](https://0xjcf.github.io/ignite-element/api/compatibility/) | A06–A12; preserve subjects/anchors | queued |
| [overview/ignite-for-ai-agents/](https://0xjcf.github.io/ignite-element/overview/ignite-for-ai-agents/) | [guides/agent-runtime-v3/](https://0xjcf.github.io/ignite-element/guides/agent-runtime-v3/) | A06–A12; preserve subjects/anchors | queued |
| [concepts/the-ignite-model/](https://0xjcf.github.io/ignite-element/concepts/the-ignite-model/) | [handbook/sources/](https://0xjcf.github.io/ignite-element/handbook/sources/) | A06–A12; preserve subjects/anchors | queued |
| [concepts/rendering/](https://0xjcf.github.io/ignite-element/concepts/rendering/) | [handbook/views/](https://0xjcf.github.io/ignite-element/handbook/views/) | A06–A12; preserve subjects/anchors | queued |
| [guides/](https://0xjcf.github.io/ignite-element/guides/) | [handbook/examples/](https://0xjcf.github.io/ignite-element/handbook/examples/) | A06–A12; preserve subjects/anchors | queued |
| [guides/host-app-integration/](https://0xjcf.github.io/ignite-element/guides/host-app-integration/) | [handbook/views/](https://0xjcf.github.io/ignite-element/handbook/views/) | A06–A12; preserve subjects/anchors | queued |
| [guides/redux-and-mobx/](https://0xjcf.github.io/ignite-element/guides/redux-and-mobx/) | [handbook/sources/](https://0xjcf.github.io/ignite-element/handbook/sources/) | A06–A12; preserve subjects/anchors | queued |
| [guides/events/](https://0xjcf.github.io/ignite-element/guides/events/) | [handbook/events/](https://0xjcf.github.io/ignite-element/handbook/events/) | A06–A12; preserve subjects/anchors | queued |
| [2.x/contributing/shared-controller-validation/](https://0xjcf.github.io/ignite-element/2.x/contributing/shared-controller-validation/) | [2.x/](https://0xjcf.github.io/ignite-element/2.x/) | A06–A12; preserve subjects/anchors | queued |

## Linked examples

Paths are repository-relative; README and implementation files travel together only when their slice is authorized. E01–E10 remain queued.

| Destination | Findings | Associated source | Status | Review evidence / next check |
| --- | --- | --- | --- | --- |
| [adapters/mobx](../../../examples/adapters/mobx/README.md) | E09 | `examples/adapters/mobx/README.md`, `src/`, manifest and Vite config where present | queued | Inline inference; lifecycle ownership. |
| [adapters/redux](../../../examples/adapters/redux/README.md) | E09 | `examples/adapters/redux/README.md`, `src/`, manifest and Vite config where present | queued | ctx and imports. |
| [adapters/xstate](../../../examples/adapters/xstate/README.md) | E05 | `examples/adapters/xstate/README.md`, `src/`, manifest and Vite config where present | queued | Missing config, old import; playground unverified. |
| [agents/smart-home](../../../examples/agents/smart-home/README.md) | E07 | `examples/agents/smart-home/README.md`, `src/`, manifest and Vite config where present | queued | Destination label, historical GAPS.md. |
| [agents/voice-workbench](../../../examples/agents/voice-workbench/README.md) | E08, E10 | `examples/agents/voice-workbench/README.md`, `src/`, manifest and Vite config where present | queued | Source aliases; provider/date claims; timeout comparison. |
| [apps/dashboard-with-shared-state](../../../examples/apps/dashboard-with-shared-state/README.md) | E08 | `examples/apps/dashboard-with-shared-state/README.md`, `src/`, manifest and Vite config where present | queued | Dependency mode and native vs DOM events. |
| [apps/form-with-validation](../../../examples/apps/form-with-validation/README.md) | E04 | `examples/apps/form-with-validation/README.md`, `src/`, manifest and Vite config where present | queued | Keyed API and test instructions. |
| [apps/nested-child-router](../../../examples/apps/nested-child-router/README.md) | E06 | `examples/apps/nested-child-router/README.md`, `src/`, manifest and Vite config where present | queued | Standalone commands. |
| [apps/shared-controller](../../../examples/apps/shared-controller/README.md) | E03 | `examples/apps/shared-controller/README.md`, `src/`, manifest and Vite config where present | queued | Current lifetime and preparation rules. |
| [apps/spa-router](../../../examples/apps/spa-router/README.md) | E06 | `examples/apps/spa-router/README.md`, `src/`, manifest and Vite config where present | queued | Malformed URL and standalone commands. |
| [frameworks/react](../../../examples/frameworks/react/README.md) | E01 | `examples/frameworks/react/README.md`, `src/`, manifest and Vite config where present | queued | Deliberately shared interop, optional isolated ref. |
| [frameworks/svelte](../../../examples/frameworks/svelte/README.md) | E09 | `examples/frameworks/svelte/README.md`, `src/`, manifest and Vite config where present | queued | Preserve instance interop. |
| [frameworks/vue](../../../examples/frameworks/vue/README.md) | E09 | `examples/frameworks/vue/README.md`, `src/`, manifest and Vite config where present | queued | Declarative event/casing. |
| Native fixture | E02 | `scripts/__tests__/fixtures/react-native-bindings/consumer.tsx`, `scripts/__tests__/fixtures/handbook/CounterScreen.tsx` | queued | Preserve negative tests; distinguish runnable guidance. |

## READMEs and supporting source inventory

Reused from the prior handbook inventory; classifications below preserve its context without claiming this pass has reviewed the content. Site routes and examples are listed above. Governing files, runtime, accepted architecture, release procedures and inactive history remain reference-only and outside this task’s mutation scope.

| Source | Findings / context | Status | Evidence |
| --- | --- | --- | --- |
| `CONTRIBUTING.md` | Related-page cross-check; retained current contributor guidance | queued | Prior inventory only; page-specific verification pending. |
| `README.md` | A01, A08, A10, A11; corrected current guidance | queued | Prior inventory only; page-specific verification pending. |
| `docs/accessibility-by-default.md` | Related-page cross-check; accepted design; preserved | queued | Prior inventory only; page-specific verification pending. |
| `docs/actor-web-evidence-governed-projections.md` | Related-page cross-check; normative optional consumer contract; preserved | queued | Prior inventory only; page-specific verification pending. |
| `docs/adr-003-shared-arc.md` | Related-page cross-check; historical/archived; preserved | queued | Prior inventory only; page-specific verification pending. |
| `docs/api/README.md` | Related-page cross-check; shortened to canonical links with explicit beta/stable version context; Navigator reference correction | queued | Prior inventory only; page-specific verification pending. |
| `docs/can-execute.md` | Related-page cross-check; corrected current guidance | queued | Prior inventory only; page-specific verification pending. |
| `docs/core-api-bindings.md` | Related-page cross-check; corrected current beta.14 reference | queued | Prior inventory only; page-specific verification pending. |
| `docs/demo/v3-headless-smart-home-screencast.md` | Related-page cross-check; retained specialist demo instructions | queued | Prior inventory only; page-specific verification pending. |
| `docs/effects-change-detection.md` | Related-page cross-check; rejected design history; preserved | queued | Prior inventory only; page-specific verification pending. |
| `docs/event-shape.md` | Related-page cross-check; historical accepted cutover record; preserved | queued | Prior inventory only; page-specific verification pending. |
| `docs/examples/README.md` | Related-page cross-check; corrected current guidance | queued | Prior inventory only; page-specific verification pending. |
| `docs/ignite-query.md` | Related-page cross-check; proposal; explicitly labeled | queued | Prior inventory only; page-specific verification pending. |
| `docs/ignite-react.md` | Related-page cross-check; shortened current guidance; handbook authority | queued | Prior inventory only; page-specific verification pending. |
| `docs/ignite-shell.md` | Related-page cross-check; historical API with corrected current migration | queued | Prior inventory only; page-specific verification pending. |
| `docs/ignite-tools.md` | Related-page cross-check; corrected current reference | queued | Prior inventory only; page-specific verification pending. |
| `docs/ignite-web3.md` | Related-page cross-check; proposal; explicitly labeled | queued | Prior inventory only; page-specific verification pending. |
| `docs/ignite-websocket.md` | Related-page cross-check; proposal; explicitly labeled | queued | Prior inventory only; page-specific verification pending. |
| `docs/migrations/adr-003-package-boundaries.md` | Related-page cross-check; historical/archived; preserved | queued | Prior inventory only; page-specific verification pending. |
| `docs/migrations/v1.4.7-callback-facade.md` | Related-page cross-check; historical/archived; preserved | queued | Prior inventory only; page-specific verification pending. |
| `docs/migrations/v2.0.0-ignite-jsx.md` | Related-page cross-check; historical/archived; preserved | queued | Prior inventory only; page-specific verification pending. |
| `docs/migrations/v2.2.3-effects-events.md` | Related-page cross-check; historical/archived; preserved | queued | Prior inventory only; page-specific verification pending. |
| `docs/renderer-selection.md` | Related-page cross-check; accepted design with historical baseline; preserved | queued | Prior inventory only; page-specific verification pending. |
| `docs/renderers/README.md` | Related-page cross-check; retained current guidance | queued | Prior inventory only; page-specific verification pending. |
| `docs/renderers/diffing-rollout.md` | Related-page cross-check; historical rollout notes; preserved | queued | Prior inventory only; page-specific verification pending. |
| `docs/reviews/v3-source-free-core-implementation.md` | Related-page cross-check; historical/archived; preserved | queued | Prior inventory only; page-specific verification pending. |
| `docs/shared-architecture-model.md` | Related-page cross-check; draft companion; corrected effects terminology | queued | Prior inventory only; page-specific verification pending. |
| `docs/site/README.md` | Related-page cross-check; corrected current guidance | queued | Prior inventory only; page-specific verification pending. |
| `docs/source-free-core.md` | Related-page cross-check; corrected current usage | queued | Prior inventory only; page-specific verification pending. |
| `docs/source-native-provisioning.md` | Related-page cross-check; normative architecture preserved; corrected current release wording | queued | Prior inventory only; page-specific verification pending. |
| `docs/styling/README.md` | Related-page cross-check; retained current guidance | queued | Prior inventory only; page-specific verification pending. |
| `docs/testing.md` | Related-page cross-check; corrected current guidance | queued | Prior inventory only; page-specific verification pending. |
| `docs/v3-api-consistency.md` | Related-page cross-check; historical vocabulary index; release wording corrected | queued | Prior inventory only; page-specific verification pending. |
| `docs/view-context-canonicalization.md` | Related-page cross-check; accepted implemented states contract; preserved | queued | Prior inventory only; page-specific verification pending. |
| `docs/when-code-becomes-cheap.md` | Related-page cross-check; historical essay; preserved | queued | Prior inventory only; page-specific verification pending. |
| `packages/ignite-adapters/README.md` | Related-page cross-check; retained current guidance | queued | Prior inventory only; page-specific verification pending. |
| `packages/ignite-core/README.md` | Related-page cross-check; retained current guidance | queued | Prior inventory only; page-specific verification pending. |
| `packages/ignite-element/README.md` | A01, A08, A10, A11; corrected current guidance | queued | Prior inventory only; page-specific verification pending. |
| `packages/ignite-renderer/README.md` | Related-page cross-check; retained current guidance | queued | Prior inventory only; page-specific verification pending. |

## Shared dependencies and exports

| Surface | Findings | Source | Status | Evidence |
| --- | --- | --- | --- | --- |
| Header, rail, selectors, prose, tables | A06–A09 | `docs/site/src/styles/theme.css`, `components/Header.astro`, `components/ThemeSelect.astro`, `src/rehype-scrollable-tables.mjs` | awaiting review | All five viewport widths, both themes; representative tables, long code and v2. |
| Eight handbook entries and retained Guides group | A11; Operator navigation request | `docs/site/astro.config.mjs` | awaiting review | Native collapsible guide group; primary order and separate archive navigation retained. |
| Getting started light switch | A10 | `docs/site/src/examples/light-switch/`, `components/LightSwitchDemo.astro` | awaiting re-review | Same behavior and presentation; command target changed to source. Download is explicitly preview source pending the supporting release. Historical beta.14 fixture remains checked. |
| Sources examples | A01, A08, A10 | `scripts/__tests__/fixtures/handbook/redux.ts`, `mobx.ts` | awaiting review | Unchanged source modules; strict packed consumer and fresh published-package execution verified for Sources. |
| Current agent exports | A01, A08, A10 | `docs/site/scripts/generate-agent-docs.mjs` → `dist/llms-full.txt`, `llms.txt`, `llms-small.txt` | awaiting review | Getting started and Sources regenerated; other page findings remain queued in the same export. |
| Historical agent export | A12 | generator → `dist/llms-v2.txt` | queued | Keep separate; no archival API edits in this slice. |
