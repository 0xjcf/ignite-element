# Clear source inputs and copyable modules

## Scope and starting identity

The Operator requested clear per-element source guidance for every documented
adapter, with copyable examples that work. This follows the confirmation that a
Redux slice is the simplest isolated Redux input.

- Branch: `fas/docs-getting-started-source`.
- Starting commit: `9adf0ce96343d1a74501a5cc424a87d7f0384c03`.
- Starting tree: `8389d1b384b288f10572e6767cbdcb923918f1a9`.
- Starting state: clean.

## Documentation changes

Sources now starts with the per-element input mapping: an XState machine,
a Redux slice, or a MobX factory that creates a fresh observable on each call.
Returning an existing observable from a function is explicitly identified as
sharing that observable's state.

The Redux section uses the new complete `redux-slice.ts` module as its main
example. The checked store factory remains in an optional disclosure for custom
middleware or combined reducers. Both examples keep inline inference and use
`commands({ source })`.

The unchanged MobX module includes its imports, `Counter` class and observable
initialization. The prose explains `makeAutoObservable(this)`, creation inside
the factory, and actions on the active instance rather than the snapshot.

The page distinguishes a complete source/core module from rendering a view and
links to the existing view registration instructions. Shared source examples
remain in the separate guide. XState continues to use the complete Getting
started light switch.

## Executable verification

Added `source-isolation.test.ts` to the strict packed web consumer. It imports
the exact displayed Redux slice, optional Redux factory and MobX factory files.
Each test mounts two elements through the public JSX entrypoint, clicks actual
buttons, and checks counts `0 / 0`, `1 / 0`, then `1 / 2` before cleanup.

The primary-consumer script copies both new fixtures unchanged, compiles with
`strict: true` and `skipLibCheck: false`, and runs these assertions against locally
packed public packages. All seven web tests passed, including the existing
canonical XState light-switch isolation test. Both native tests and the separate
historical registry beta.14 test also passed. The standalone light-switch project
passed strict compilation and its Vite build.

A local Vite sandbox imports the exact four candidate modules: Redux slice,
Redux store factory, MobX factory and the canonical XState light switch. In-app
browser interaction confirmed `0 / 0` → `1 / 0` → `1 / 2` for each pair. The
sandbox uses installed local package tarballs, with no workspace source aliases.
Preview: <http://127.0.0.1:4332/source-preview.html>.

## Documentation validation

Documentation snippet checks, Astro checks, the 68-page build, agent exports,
3,023 internal links, seven handbook tests and 299 publication policy tests passed.
The handbook check preserves legacy fragments and canonical ZIP/export equality.
Architecture and formatting checks passed. The existing responsive, contrast and
interaction suite was rerun for the added source-input table and disclosure.
Normal commit hooks remain enabled.

## Custody and limits

Runtime source, package versions, dependencies, lockfile, workflows and archived
pages are unchanged. Pre-existing package build output was reused because those
inputs are unchanged. New packed consumer installations and browser evidence are
retained in task-local temporary storage; existing docs output was refreshed for
preview. No package build or runtime-suite repetition was needed beyond the
focused packed examples. Consumer validation took under a minute; browser
interaction and responsive checks took a few minutes in total.

This proves the examples against the supporting local package candidate. It does
not prove a public beta installation of these APIs. The supporting release must
be published and its registry installation verified before documentation deployment.
No push, release preparation, publication or deployment occurred.

Getting started awaits re-review. Sources awaits review. Views remains queued.
