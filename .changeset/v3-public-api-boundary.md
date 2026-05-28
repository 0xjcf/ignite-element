---
"ignite-element": major
---

Narrow the stable public API for v3 so `ignite-element` only publishes the root entrypoint, adapter entrypoints, JSX entrypoints, and package metadata.

Removed the stable `ignite-element/config/*` and `ignite-element/renderers/*` subpaths, and removed root exports for config loaders, renderer strategy registration, global style mutation, and factory internals. `ignite-renderer` does not replace those removed public subpaths with new stable loader or plugin APIs. Advanced apps that still need shared styles or renderer diagnostics should import the underlying `ignite-renderer` config primitives directly in app-owned code, while the old loader/plugin behavior remains internal compatibility rather than part of the public v3 API.

Added export-boundary verification that locks the public subpath allowlist, checks `typesVersions` parity, and fails if removed stable paths are reintroduced.

Documented the v3 agent runtime contract: `execute(...)`, `story.execute(...)`, and `story.until(...)` are Promise-returning APIs. Story workflow helpers now expose serializable snapshots through `IgniteStorySnapshot`, `IgniteStoryTraceSnapshot`, `IgniteStorySnapshotEvent`, and `IgniteStorySummarySnapshot`, with snapshot summary state, view, and event payloads represented as `IgniteSchemaValue` JSON data.
