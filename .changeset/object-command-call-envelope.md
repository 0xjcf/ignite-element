---
"ignite-element": major
---

Breaking v3 beta: replace positional command calls with the `{ command, input? }` envelope across `igniteTest(...).when`, `IgniteAgentRuntime.execute`, and `IgniteStory.execute`, with no compatibility overloads.

Export the shared mapped-union `IgniteCommandCall` type so command names preserve required, optional, and no-input inference across runtimes and adapters. `igniteTools` now translates provider `{ name, arguments }` calls into the runtime command envelope, accepts omitted input or `{}` for true no-argument commands, and returns `InvalidInput` for unexpected no-argument input.
