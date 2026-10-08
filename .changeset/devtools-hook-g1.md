---
"ignite-element": minor
---

Add a development-only `ignite-element/devtools-hook` entry that exports `installDevtoolsHook`. While installed, it receives each outward native or effect event as `{ coreId, type, payload, origin, at }`. Production bundles of the existing entrypoints omit the hook, and nothing is published when it is not installed. The hook type reserves a `command` callback for a later command tap. In development, registering a custom element tag that is already defined by a different component warns once; registering that same component again stays silent.
