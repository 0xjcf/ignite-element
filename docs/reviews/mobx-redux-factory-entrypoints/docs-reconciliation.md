# Parked documentation reconciliation

## Preserved checkpoints

Original parked branch `fas/docs-page-refinement`:

- Commit: `1cfc2310557e9ed602c6e7f9524e9827e45f4dbc`.
- Tree: `14689a7da715fa2cfde41745438f7485bbb34b5d`.

Current editorial successor `fas/docs-getting-started-source`:

- Commit: `5800ebfb082a3235449486377dfed250c0c00b1f`.
- Tree: `0f61fcee894b5afaa549869ebe14fa5a6e603f91`.

Both were clean before and after this task. Getting started awaits re-review;
Sources awaits review; Views is queued. No approval has advanced.

Getting started's actual canonical file,
`docs/site/src/examples/light-switch/src/light-switch.tsx`, imports
`ignite-element/xstate` and passes `source: toggleMachine`.
This correction does not affect that example; do not add an adapter catalogue.

## Exact edits when editorial work resumes

Preserve the successor's short paragraphs, headings, navigation, theme work,
Actor-Web removal and absence of beta-to-beta migration notes. Do not replace
whole editorial pages with the older beta baseline versions from this branch.

In `docs/site/src/content/docs/handbook/sources.mdx`, replace the two MobX
paragraphs currently beginning “For an isolated observable per element” and
“The explicit adapter identifies” with:

> For a separate observable per element, pass a factory: `source: () => new Counter()`.
>
> Import `igniteCore` from `ignite-element/mobx`; the import selects the adapter.
>
> Passing an observable instance shares it between views.

Keep the existing shared-instance paragraph once, rather than duplicating it.
The dedicated import accepts an explicit matching discriminator for compatibility,
but it is not needed in the ordinary factory example.

In the Redux section, retain its existing instance and slice explanation. Add:

> For a separate configured store per element, pass `source: () => configureStore({ reducer: slice.reducer })`.
>
> Import `igniteCore` from `ignite-element/redux`; no `adapter` property is needed.

The complete checked examples added by this candidate are
`scripts/__tests__/fixtures/handbook/mobx-factory.ts` and `redux-factory.ts`.
If both factory examples are shown in Sources, import these canonical files with
`?raw` and render them with Starlight's `Code`, as the current candidate does.
Do not duplicate unchecked snippets or introduce a disposal wrapper.

Apply the narrow API and ownership changes: dedicated factories omit `adapter`,
matching explicit values remain accepted, factories isolate elements, and live
instances share their source. The public root stays source-free. The internal
ambiguous-factory dispatcher rule belongs only in maintenance/test material.

Carry forward the MobX README/runnable example correction and the Redux README
factory link. Preserve the successor's removal of stale `actor` descriptions.
Carry forward the two new fixture entries in the packed primary-consumer checker
without reverting its newer quickstart/archive handling.

Sources needs review with these changes. API, ownership and directly linked
examples need a focused consistency review. Views remains queued. Getting started
has no new factory-related change but retains its pre-existing re-review checkpoint.

## Coordinated release boundary

Compile these examples against the local candidate, as this task did. Do not
claim that registry beta.14 or today's public beta accepts the new omission.
Do not guess a release number. Finish and accept the documentation pages, publish
the supporting beta under separate authorization, verify its availability, then
explicitly deploy the matching documentation. Keep that sequencing in review and
release receipts rather than adding beta-to-beta migration material to the pages.
