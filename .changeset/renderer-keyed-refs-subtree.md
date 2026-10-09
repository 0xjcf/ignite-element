---
"ignite-element": patch
"@ignite-element/renderer": patch
---

Reconcile keyed JSX children by moving the existing nodes, and give `ref` the mount contract.

`key` preserves node identity, focus, and input value across prepend, insert, removal, and reorder. Unkeyed siblings stay positional. Duplicate keys warn in development.

`ref` is called with the element on mount, with `null` before that node is removed, and with `null` when the host component disconnects. Replacing the callback calls the previous one with `null`, then the next one with the same element. An unchanged callback does not run again on later renders.

Elements that own their subtree — `innerHTML`, `textContent`, or a host claim — are skipped by the differ. `innerHTML` and `textContent` are deprecated and will be removed in the next major release. Use JSX children for text, and hosts for trusted rich content.
