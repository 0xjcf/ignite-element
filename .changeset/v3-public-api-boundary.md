---
"ignite-element": major
---

Narrow the stable public API for v3 so `ignite-element` only publishes the root entrypoint, adapter entrypoints, JSX entrypoints, and package metadata.

Removed the stable `ignite-element/config/*` and `ignite-element/renderers/*` subpaths, and removed root exports for config loaders, renderer strategy registration, global style mutation, and factory internals. Use `ignite-renderer` for advanced shared style, renderer, and legacy config compatibility work.

Added export-boundary verification that locks the public subpath allowlist, checks `typesVersions` parity, and fails if removed stable paths are reintroduced.
