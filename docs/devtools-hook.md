# DevTools hook

`ignite-element/devtools-hook` exports `installDevtoolsHook(hook)`. It is a development-only public entry. Production bundles of the other entrypoints do not include it, and calling it in production returns an uninstall function that does nothing.

```ts
import { installDevtoolsHook } from "ignite-element/devtools-hook";

const uninstall = installDevtoolsHook({
  event(record) {
    // { coreId, type, payload, origin: "native" | "effect", at }
  },
});

uninstall();
```

While the hook is installed, each outward event the runtime already classifies as native or effect is delivered once at that observation. `origin` is `"native"` for events bridged from the source and `"effect"` for events declared and emitted by effects. `payload` is the event without its `type`. `coreId` stays stable for the acquired source that produced the event.

Nothing is allocated or published when no hook is installed. A hook that throws does not change delivery. Uninstalling stops later events. Installing again replaces the previous hook; uninstalling restores it.

`command` may be present on the hook object. It is not called yet. A later command tap can report `{ coreId, command, input, origin: "view" | "execute" | "tools", outcome, durationMs }` through that method without changing `installDevtoolsHook`.

In development, registering a custom element tag that is already defined by a different component warns once on the console and keeps the existing element. Registering that same component again does not warn. Production registration is unchanged.
