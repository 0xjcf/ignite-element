---
"ignite-element": minor
---

Report facade commands through the development-only `ignite-element/devtools-hook`. While `installDevtoolsHook` is installed, each command settles as `{ coreId, command, input, origin, outcome, durationMs }`. `origin` is `view` for a view call such as `ctx.toggle()`, `execute` for `core.execute`, and `tools` for `igniteTools`. A thrown command is reported and still throws. The production hook stays a no-op, and production bundles of the existing entrypoints omit the tap.
