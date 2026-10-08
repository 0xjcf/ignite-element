---
"ignite-element": minor
---

Add a development-only `ignite-element/devtools-hook` entry that exports `installDevtoolsHook`. The published entry keeps a runtime `process.env.NODE_ENV` check so a development bundle can install it. While installed, it receives each outward effect event, and each native event the listener accepts, as `{ coreId, type, payload, origin, at }`. Production application bundles omit the hook, and nothing is published when it is not installed. The hook type reserves a `command` callback for a later command tap. In development, registering a custom element tag that is already defined by a different component warns once; registering that same component again stays silent.
