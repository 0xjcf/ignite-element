---
"ignite-element": major
---

Retire the public testing DSL, dedicated testing/story types, source-backed
`record(name)` method, story traces/summaries/lifecycle histories, and accessibility
bridge. Replace them with ordinary assertions over retained runtime commands,
events, snapshots and derived states, and DOM queries against real registered
components. Portable story receipts and complete lifecycle recording are
intentionally removed without aliases or a replacement recorder. Applications and
sources retain ownership of asynchronous work and native lifetime.
