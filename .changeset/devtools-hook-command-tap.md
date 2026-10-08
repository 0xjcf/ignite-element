---
"ignite-element": minor
---

Report facade commands through the development-only `ignite-element/devtools-hook`. While `installDevtoolsHook` is installed and the hook has a `command` callback, each command settles as `{ coreId, command, input, origin, outcome, durationMs }`. `origin` is `view` for a view call such as `ctx.toggle()`, `execute` for `core.execute`, and `tools` for `igniteTools`. One argument is recorded as `input`; a view call with several arguments records that argument list. A thrown command is reported and still throws. A throw while reading `command`, or while inspecting a returned thenable, does not change the command result. The production hook stays a no-op, and production bundles of the existing entrypoints omit the tap.
