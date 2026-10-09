---
"ignite-element": minor
"@ignite-element/renderer": minor
---

Reconcile keyed JSX children by moving the existing nodes, and give `ref` the mount contract.

`key` preserves node identity, focus, and input value across prepend, insert, removal, and reorder. Unkeyed siblings stay positional. Duplicate or mixed keys warn in development and match by position.

`ref` is called with the element on mount. If the callback returns a function, that disposer runs on removal, host disconnect, and ref swap, and `ref(null)` is not also called. If the callback returns nothing, it is called with `null` in those same cases. Replacing the callback runs the previous cleanup, then calls the next callback with the same element. An unchanged callback does not run again on later renders.

Elements that own their subtree — `innerHTML`, `textContent`, or a host claim — are skipped by the differ. `innerHTML` and `textContent` are deprecated and will be removed in the next major release. Use JSX children for text, and hosts for trusted rich content.
