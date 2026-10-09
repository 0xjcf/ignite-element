---
"ignite-element": patch
---

Independent cores subscribe on the first `execute`, the same way `get("states")` does. Redux listeners and MobX observations start without a prior read. An existing watch keeps its own snapshot delivery. Untouched cores stay idle, and a user-started shared source is unchanged.
