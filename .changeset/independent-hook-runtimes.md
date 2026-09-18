---
"ignite-element": minor
---

Give each React and React Native hook its own runtime for XState machines, Redux slices or fresh-store factories, and MobX fresh-observable factories. Keep synchronous inferred ctx, shared existing-source ownership, and separate explicit headless operations. Independent unmount now releases its owned runtime automatically; core disposal drains every committed runtime. Factories and initialization, including middleware/enhancers, must be safe to repeat and discard without external work or cleanup obligations.

Retain independent state and active source resources through Activity hiding while view delivery is disconnected. Descendant layout effects and callback refs may issue commands after attachment; actual removal and core replacement release the old runtime.
