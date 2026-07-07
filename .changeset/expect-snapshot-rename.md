---
"ignite-element": minor
---

Rename the headless runtime and testing surfaces from state to snapshot for the v3 beta cutover. The test DSL now exposes `expectSnapshot(...)` instead of `expectState(...)`; execution results return `{ snapshot, events }`; schemas return `snapshot`; story summaries return `finalSnapshot`; and story traces record `kind: "snapshot"` entries with a `snapshot` value.
