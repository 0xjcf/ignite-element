# Ignite Element public API notes

These notes describe the current **v3 beta** contract. Install `ignite-element@beta`
and the state library for your chosen entrypoint. v3 is not yet stable. Stable v2.2.2 users
should read the [v2 archive](https://0xjcf.github.io/ignite-element/2.x/).

Use the current handbook as the API authority:

- [API reference](https://0xjcf.github.io/ignite-element/handbook/api/): construction, registered handles, configuration, bindings and runtime return shapes.
- [Sources](https://0xjcf.github.io/ignite-element/handbook/sources/): supported source entrypoints and factory discriminators.
- [Ownership and cleanup](https://0xjcf.github.io/ignite-element/handbook/ownership/): observation lifetime, terminal core disposal and borrowed sources.
- [Events and effects](https://0xjcf.github.io/ignite-element/handbook/events/): native occurrences, declarations and queued delivery.

Keep `states` and `commands` inline for inference and render through `ctx`.
