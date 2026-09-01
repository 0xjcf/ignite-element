---
"@ignite-element/core": minor
"@ignite-element/adapters": minor
"ignite-element": minor
---

Make `states(snapshot)` the canonical optional v3 projection contract. Config
`view`, `getView`, and `watchView` are removed; headless schemas, execution
results, stories, tests, and tools now use states vocabulary. XState entrypoints
expose native `StateFrom<Machine>` snapshots instead of flattened
`ExtendedState`, and public component renderers receive derived states and
semantic commands without raw `state` or `send`.
