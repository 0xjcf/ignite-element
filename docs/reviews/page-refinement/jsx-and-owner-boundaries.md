# JSX teaching path and owner-boundary cleanup

## Scope and identity

The Operator identified advanced-config promotion in current guidance and proposed
precise hook/core/source ownership wording and a concrete session-end example.
The Operator also asked to consider future Lit support; this did not authorize a
runtime or public-contract removal.

- Branch: `fas/docs-getting-started-source`.
- Starting commit: `2c2335481feb6c22c69b2231779db008c95a256e`.
- Starting tree: `0d11d3b5e149466f8253bb9d8d6346ae085b1f5a`.
- Starting state: clean.

## Rendering guidance

Removed advanced-config/Lit promotion from the primary handbook and related API,
renderer, styling and XState example README guidance. New component instructions
use Ignite JSX and local or linked shadow-root styles. Legacy configuration/API
setup routes now lead to the v2-to-v3 migration guide; the old tooling route
leads to Getting started. A focused route assertion protects those destinations.

The old advanced-config URL remains reachable as “Renderer compatibility,” with
an explicit existing-application scope and links to the recommended JSX path.
Only migration and compatibility pages link to it in current site guidance.
Archived v2 pages and historical records are preserved.

Current source still exports `defineIgniteConfig` and the optional Lit renderer.
Lit registration and output auto-detection work independently of the config file.
The question of removing either API remains a separate contract decision; this
pass does not label supported exports as absent or promise their future retention.

## Ownership guidance

Views, Sources, Events, Ownership, shared-source guidance and the React README
now describe permanent disposal by the owning feature or session rather than an
ambiguous application-shutdown callback. The event example comment uses the same
owner boundary. No executable behavior changed.

The Ownership page includes imports from the actual shared counter example and
cleanup lines explicitly placed inside the existing session-end handler. It
explains exclusive actor ownership, shared actor retention, new cores for later
sessions, ordinary navigation, native backgrounding and the absence of a reliable
process-termination hook. A responsibilities table distinguishes view subscription,
core lifetime, borrowed actor shutdown and private actor release.

React and React Native views need no cleanup effect for their hook subscription.
The hook borrows the core, which remains usable across unmounts and later mounts.
No cleanup wrapper or source-lifetime API was introduced.

## Evidence and validation

Authenticated the Operator-linked `useIgnite.ts` at beta commit
`af0de5696b60922aacbbcc895879adcc72851357`; it and the linked lifecycle test file
match the current candidate. All nine hook lifecycle tests passed, including
StrictMode/multiple consumers and a gap with no React subscribers.

Documentation snippet checks passed 27 blocks, with one existing fragment and
seven existing explicit exclusions. Formatting and Markdown checks passed.
The 68-page build and agent export passed. Eight handbook tests and 3,059 internal
references passed. All 299 publication-policy tests passed. The registered-core
disposal assertion initially caught wording moved away from its contract sentence;
the prose now states that contract explicitly, without weakening the assertion.

Browser inspection confirmed the new session example, responsibilities table and
navigation/backgrounding explanations. Current agent exports no longer teach
“final application shutdown.” Runtime code, live-demo behavior and CSS are
unchanged, so packed consumers and the full responsive matrix were not repeated.

## Custody and remaining decision

Runtime source, package manifests, lockfile, deployment workflow and archived
pages are unchanged. Existing documentation output was refreshed for preview.
No install, package release, push or deployment occurred. Focused checks and each
build took seconds; the normal local commit hooks remain enabled.

The parked documentation branch remains clean at
`1cfc2310557e9ed602c6e7f9524e9827e45f4dbc`, tree
`14689a7da715fa2cfde41745438f7485bbb34b5d`.

Getting started awaits re-review; Sources awaits review; Views remains queued for
page acceptance. A future Lit/config removal would need explicit contract scope
and consumer/export verification before implementation.
