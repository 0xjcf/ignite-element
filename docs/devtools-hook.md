# DevTools hook

`ignite-element/devtools-hook` exports `installDevtoolsHook(hook)`. The package publishes two artifacts for that entry. The `development` export condition selects the one that records events and commands. The `import` and `default` conditions select a no-op, which is what production builds receive.

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

`command` receives each facade command when it settles:

```ts
installDevtoolsHook({
  command(record) {
    // { coreId, command, input, origin: "view" | "execute" | "tools", outcome, durationMs }
  },
});
```

`origin` is `"view"` when a view calls the command function, as in `ctx.toggle()`. It is `"execute"` for `core.execute({ command, input })`, and `"tools"` when `igniteTools` runs the command. `execute` reads `input` before it marks the call. If that read throws, or the command returns without consuming the mark, the mark is cleared and the next view call stays `"view"`. `input` is the argument the command was called with, or `undefined` when the call passes none. A view call with more than one argument records that argument list, so `ctx.tuple(2, 3)` reports `input: [2, 3]`. `outcome` is the settled return value. A thrown or rejected command is still reported, with the thrown value as `outcome`, and the error still propagates. If the returned value's `then` cannot be read or called, that failure stays inside the tap: the command returns the same value and does not throw the tap's error. `durationMs` is the time until settlement. `coreId` is the same id the event tap uses for that core.

A hook that throws does not change the command result or the returned promise. That includes a `command` property whose read throws. Nothing is published, and no command record is allocated, when no hook is installed or the installed hook has no `command` callback. The development command function does not add a second proxy on top of the guard production already uses. Uninstalling stops later commands. Production builds omit the tap, and calling `installDevtoolsHook` there returns a no-op.

In development, registering a custom element tag that is already defined by a different component warns once on the console and keeps the existing element. Registering that same component again does not warn. Production registration is unchanged.

The same `development` condition is on every public entry, including JSX, React, and tools. A bundler applies the condition to each specifier on its own. If only the runtime moved to the development artifact, shared modules such as the binding store would load twice and a React view would not see the core that registered it. Import the hook and the runtime under the same condition. A development hook installed against the production runtime receives nothing, because that runtime never calls it.

## How export conditions choose the file

A package `exports` map can point one import at more than one file. The resolver walks the keys in order and uses the first condition it was given.

`development` is listed before `import` and `default`. The resolver walks the keys in source order and stops at the first condition it was given. Tools that are building for development add `development` to that list: Node with `node --conditions=development`, Vite's dev server, and webpack when `mode` is `"development"`. They receive the artifact that records events and commands, and warns on tag collisions. Production builds do not set that condition, so they fall through to `import` / `default`. Those files are the no-op. They do not contain the hook body, the tag warning, or the call sites that would publish events or commands. `size:entrypoints` reads the `import` file, so the development artifact is not part of that measurement.
