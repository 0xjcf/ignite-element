---
"ignite-element": patch
---

Fix #57: toggling an element between JSX children and an `innerHTML` /
`dangerouslySetInnerHTML` / `textContent` branch across re-renders now
**replaces** the previous subtree instead of appending duplicate children.
innerHTML-owned subtrees are treated as opaque (child diffing is skipped), and
when an element switches back to JSX children the renderer hard-clears the
subtree with `replaceChildren()` before diffing, so child count no longer
accumulates on each round-trip.
