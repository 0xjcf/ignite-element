# Ignite DevTools

`@ignite-element/devtools` is a private workspace package at version `0.0.0`. It is not published, and it sits outside the core changesets group.

The M0 skeleton contains:

- a hand-written manifest validator, with catalog component names taken from the build list
- in-memory connection, storage, and clock ports
- a connection source (`disconnected`, `connecting`, `connected.live`, `connected.paused`, `error`) bound with `igniteCore` from `ignite-element/xstate`

Ports are passed to the XState machine with `.provide()`. They are not an `igniteCore` option. No DevTools UI and no catalog components are built in this package yet.

The package peers `ignite-element` at `3.0.0-beta.18` and `xstate` at `>=5.19.0`.

Core packages must not import this package. That architecture rule is not applied in this change.
