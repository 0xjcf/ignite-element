# igniteShell: historical contract and migration

`igniteShell` was implemented and publicly exported in released 3.0.0-beta.11.
The old “design only — not implemented” status was stale. The original design
remains in Git history at `e2eb1517c8818a16a3142ff2c2b6c534674625d4`.

The unpublished review candidate explicitly replaces it with
[source-free root igniteCore](./source-free-core.md), retiring the shell export,
its four shell-specific types, and the onConnect/returned-teardown capability.
This is a breaking amendment, not an alias or a published-release claim.

Declarative consumers migrate their import and named constructor, retaining JSX
composition. Hook consumers need an application-owned presentation boundary or
an existing custom element: initial state, updates, cleanup, moves and reconnect
remain real responsibilities. External adoption is unknown.

The historical disposeRuntime-on-disconnect sketch is not current source-ownership
guidance. Applications own native source shutdown. Ignite effects are synchronous,
void-returning outward-fact callbacks; they cannot return retained-resource cleanup.
See [source-free core](./source-free-core.md) for the complete migration.

Shared source-backed move-safe lifecycle remains unchanged. Accepted
refs/commit/keyed architecture remains unimplemented and is not a prerequisite
for this naming and lifecycle amendment.
