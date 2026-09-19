# Views live examples

## Authorization and starting identity

The Operator approved the discussed live shared-counter and custom-element event
demos, removal of the teardown comment, and corresponding code examples.

- Branch: `fas/docs-getting-started-source`.
- Starting commit: `2e22bead06954f746563530a1a615dbf1e946fd0`.
- Starting tree: `d278fa2bcd7b743a0d08709552f0179b7eca007a`.
- Starting state: clean.

## What changed

Views renders two real React counters over the existing shared core and source.
Either view changes the count and label in both. The displayed code and live
component import the same canonical example modules. The teardown comment was
removed; nearby prose retains ownership and cleanup guidance.

The custom-element demo has its own increment/decrement controls. `igniteReact`
wraps the registered element, and `onCountChanged` updates React-owned state.
Before the first event the status says “Waiting for an event.” Later it shows the
received count and odd/even text, with distinct matching colors. No imperative
ref or event-driven source command is needed for this recipe. Effects emit count
facts; React owns the presentation choice.

The page shows the actual listener, binding, element and optional CSS modules.
The element loads its stylesheet by URL, matching the light-switch example.
Styles use Starlight theme tokens with standalone fallbacks and are scoped to the
demos. No theme component overrides were added.

The docs site declares React/React DOM 19.2.7 and their existing locked type
versions directly. The root lockfile changes only the docs-site importer, reusing
existing package resolutions. Vite deduplicates the imported examples' public
dependencies at the site root, so the build uses one React runtime without
requiring a separate example installation or a library-source alias.

Agent exports replace the live mounts with working page links and include the
canonical example modules verbatim. Handbook checks enforce both properties.

## Validation

The new packed interop behavior test first failed against the old example because
its event status was absent. A preliminary harness compilation failure was
resolved by including the copied CSS declaration file in the strict consumer.

The final strict packed web consumer passed all eight tests, including shared
updates/remounts, source isolation, actual custom-element button clicks, emitted
count sequence `1, 2, 1`, odd/even status, and a fresh status after remount. The
same public-package consumer compiles with `strict: true` and `skipLibCheck: false`.
The native consumer's strict compilation and both existing tests passed. The
standalone light-switch build and historical beta.14 consumer also passed.

In-app browser interaction independently confirmed shared count/label changes and
React receipt of odd and even events. Repository browser checks verified both
new demos at 1440px and 390px in dark and light themes, including keyboard input,
separate demo state, visible status text, distinct colors, zero page errors,
no page overflow and five mandatory contrast targets in both parity states.
Screenshots of both demos were inspected. The complete existing suite also passed:
60 layout cases, 64 contrast checks, 13 geometry checks, navigation and interactions.
A focused browser rerun validated the final external stylesheet and screenshots.

Other checks passed: architecture boundaries, formatting, Markdown, 25 checked
snippet blocks, Astro (zero errors/warnings and one existing hint), the 68-page
site build, seven handbook tests, 3,046 internal references, and all 299
publication-policy tests. Existing snippet exclusions were not changed.

## Custody, cost and review boundary

Package runtime/API, package versions, deployment rules and archived docs are
unchanged. Normal local commits are the only integration action in this slice.
No remote push, release preparation, publication or deployment was performed.

Existing build output was refreshed for preview. Packed consumers, logs and
screenshots remain in task-local temporary storage. Consumer checks took under a
minute per full run; later web-only checks reused unchanged packed packages.
The dependency install reused locked packages and needed the existing pnpm store.
Chromium checks required the normal macOS sandbox escalation. The full browser
matrix took roughly a minute, followed by focused demo checks after final edits.

The parked branch remains clean at `1cfc2310557e9ed602c6e7f9524e9827e45f4dbc`,
tree `14689a7da715fa2cfde41745438f7485bbb34b5d`.
Getting started awaits re-review; Sources awaits review; Views remains queued for
page acceptance. The supporting beta must still be published before live docs.
