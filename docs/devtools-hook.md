# DevTools hook

`ignite-element/devtools-hook` exports `installDevtoolsHook(hook)`. The published entry keeps a `process.env.NODE_ENV` check, so a development application bundle can install it and a production application bundle removes it. Calling it when `NODE_ENV` is production returns an uninstall function that does nothing. The other published entrypoints keep that same check around their dev-only branches; production application bundles omit those branches.

```ts
import { installDevtoolsHook } from "ignite-element/devtools-hook";

const uninstall = installDevtoolsHook({
  event(record) {
    // { coreId, type, payload, origin: "native" | "effect", at }
  },
});

uninstall();
```

While the hook is installed, each outward event the runtime delivers is reported at that delivery. Native events are reported only when the listener's name filter accepts them. `origin` is `"native"` for events bridged from the source and `"effect"` for events declared and emitted by effects. `payload` is the event without its `type`. `coreId` stays stable for the acquired source that produced the event.

Nothing is allocated or published when no hook is installed. A hook that throws does not change delivery. Installing again replaces the active hook. Uninstalling that hook restores the previous one only when the previous install is still active, so an earlier uninstall cannot be undone by a later one.

`command` may be present on the hook object. It is not called yet. A later command tap can report `{ coreId, command, input, origin: "view" | "execute" | "tools", outcome, durationMs }` through that method without changing `installDevtoolsHook`.

In development, registering a custom element tag that is already defined by a different component warns once on the console and keeps the existing element. Registering that same component again does not warn. Production registration is unchanged.
