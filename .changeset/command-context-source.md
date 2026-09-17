---
"@ignite-element/core": major
"@ignite-element/adapters": major
"ignite-element": major
---

BREAKING (beta): Command callbacks receive the resolved command target as `source`, replacing `actor` across all adapters. Replace `commands: ({ actor }) => ...` with `commands: ({ source: actor }) => ...`, or use `source` directly. The old property is removed without a compatibility alias. Source acquisition, command capabilities and native ownership are unchanged.
