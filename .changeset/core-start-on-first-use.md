---
"ignite-element": patch
---

Independent cores subscribe on the first `execute`, the same way `get("states")` does. Redux listeners and MobX observations start without a prior read. An existing watch keeps its own snapshot delivery. Untouched cores stay idle, and a user-started shared source is unchanged. An unknown command is rejected before that subscription. An invalid MobX projection is rejected before the command runs, and a watch that is already active holds a quiet observation lease until the command finishes. The development execute origin tap is unchanged.
