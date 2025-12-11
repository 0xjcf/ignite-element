---
"ignite-element": patch
---

- Fixed igniteCore event typing so emit stays strongly typed even when commands appear before events, preventing typos from compiling.

- Tightened event definition types (AnyEventsDefinition now uses EventMap) and updated tests to cover the commands-before-events scenario.