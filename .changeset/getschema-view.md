---
"ignite-element": minor
---

Expose the projected view in `getSchema()` as `IgniteAgentSchema.view`, beside `state`. An agent introspecting a component now sees the derived view shape it binds to — typed from the `view` callback's projection (`getSchema().view` mirrors `getView()`), rather than only the raw `state` snapshot. Additive: `commands`/`events`/`state` are unchanged, and `view` defaults to `IgniteSchemaValue` for the loose `IgniteAgentSchema` default. Pre-stable type addition (the view projection now flows end-to-end into the schema surface).
