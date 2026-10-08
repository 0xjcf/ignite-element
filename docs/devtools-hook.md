# DevTools hook

`ignite-element/devtools-hook` exports `installDevtoolsHook(hook)`. The package publishes two artifacts for that entry. The `development` export condition selects the one that records events. The `import` and `default` conditions select a no-op, which is what production builds receive.

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

Nothing is allocated or published when no hook is installed. A hook that throws does not change delivery. Installing again replaces the active hook. Uninstalling that hook restores the previous one only when the previous install is still active, so an earlier uninstall cannot be undone by a later one. Uninstalling the later hook first restores the earlier one; uninstalling that one too leaves no hook active.

`command` may be present on the hook object. It is not called yet. A later command tap can report `{ coreId, command, input, origin: "view" | "execute" | "tools", outcome, durationMs }` through that method without changing `installDevtoolsHook`.

In development, registering a custom element tag that is already defined by a different component warns once on the console and keeps the existing element. Registering that same component again does not warn. Production registration is unchanged.

The same `development` condition is on every public entry, including JSX, React, and tools. A bundler applies the condition to each specifier on its own. If only the runtime moved to the development artifact, shared modules such as the binding store would load twice and a React view would not see the core that registered it. Import the hook and the runtime under the same condition. A development hook installed against the production runtime receives nothing, because that runtime never calls it.

## How export conditions choose the file

A package `exports` map can point one import at more than one file. The resolver walks the keys in order and uses the first condition it was given.

`development` is listed before `import` and `default`. The resolver walks the keys in source order and stops at the first condition it was given. Tools that are building for development add `development` to that list: Node with `node --conditions=development`, Vite's dev server, and webpack when `mode` is `"development"`. They receive the artifact that records events and warns on tag collisions. Production builds do not set that condition, so they fall through to `import` / `default`. Those files are the no-op. They do not contain the hook body, the tag warning, or the call sites that would publish events. `size:entrypoints` reads the `import` file, so the development artifact is not part of that measurement.
