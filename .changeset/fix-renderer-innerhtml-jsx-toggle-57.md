---
"ignite-element": patch
---

Fix #57: toggling an element between JSX children and a `textContent` branch
across re-renders now **replaces** the previous subtree instead of appending
duplicate children. `textContent` owns that subtree (child diffing is skipped),
and when an element switches back to JSX children the renderer clears it before
diffing, so child count no longer accumulates on each round-trip. `innerHTML` is
not applied, so it cannot inject untracked nodes.
