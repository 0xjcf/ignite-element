---
"@ignite-element/core": minor
"@ignite-element/adapters": minor
"@ignite-element/renderer": minor
"ignite-element": minor
---

Canonicalize the headless-runtime raw-read surface on snapshot vocabulary and the projection config on `view`, with a clean deprecation path.

- **Added:** `getSnapshot()` and `watchSnapshot(handler)` on the headless runtime as the canonical raw-read accessor and subscription, restoring symmetry with `getView()`/`watchView()`. Added the `IgniteAgentSnapshotListener` type.
- **Deprecated (still functional, dev-mode `console.warn`, removed at stable v3):** `getState()` → use `getSnapshot()`; `watch(handler)` → use `watchSnapshot(handler)`; the existing `subscribe(eventName, handler)` alias now also warns (use `on`); the `states` projection config option and `FacadeStatesCallback` type → use `view`. `IgniteAgentStateListener` is kept as a deprecated alias of `IgniteAgentSnapshotListener`.

No behavior change: every deprecated alias delegates to its canonical counterpart and continues to work through the v3 beta. The deterministic-effects contract, `getView`, and the headless runtime remain identical across all four adapters.
