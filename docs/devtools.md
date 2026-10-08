# Ignite DevTools

`@ignite-element/devtools` is a private workspace package at version `0.0.0`. It is not published, and it sits outside the core changesets group.

The M0 skeleton contains:

- a hand-written manifest validator, with catalog component names taken from the build list
- in-memory connection, storage, and clock ports
- a connection source (`disconnected`, `connecting`, `connected.live`, `connected.paused`, `error`) bound with `igniteCore` from `ignite-element/xstate`

Ports are passed to the XState machine with `.provide()`. They are not an `igniteCore` option. No DevTools UI and no catalog components are built in this package yet.

The package peers `ignite-element` at `3.0.0-beta.18` and `xstate` at `>=5.19.0`.

Catalog component entries use the PascalCase name as `id`. A separate id field will only be added if renames need it.

`ignite-core`, `ignite-adapters`, `ignite-renderer`, and `ignite-element` `src` cannot import `packages/ignite-devtools/src`. Those four rules are in `.fas/architecture-rules.json`.

Follow-ups outside M0:

- Enforcing that DevTools imports only public `ignite-element` entrypoints needs a checker change. The current checker resolves specifiers such as `ignite-element/xstate` into `packages/ignite-element/src`, so that rule is deferred.
- The manifest-versus-`get("schema")` drift check is deferred to M1.
- Hosted CI coverage for `test:packages` is a separate change (`ci/experimental-devtools`). This package does not edit workflows.
