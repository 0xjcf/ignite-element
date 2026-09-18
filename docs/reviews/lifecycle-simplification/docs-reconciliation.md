# Parked documentation reconciliation

Preserve the existing review checkpoints. The parked candidates were inspected,
not edited or rebased:

- Getting started/source candidate: `d46c0cd9a514b645e72c3ba3dc65d2f9d9636ad1`,
  tree `a8755f07093fb893fd449ead0de436f54d3b00e0`.
- Page refinement candidate: `1cfc2310557e9ed602c6e7f9524e9827e45f4dbc`,
  tree `14689a7da715fa2cfde41745438f7485bbb34b5d`.
- Getting started awaits re-review; Sources awaits review; Views remains queued
  for page acceptance. Newer demos do not constitute acceptance.

After Navigator reviews slice A, reconcile the following paragraphs onto the
newer editorial candidates without replacing whole pages:

| Page | Reconciliation |
| --- | --- |
| Getting started | Remove `cleanup` from candidate configurations. Preserve the published beta.14 example and its historical command-context spelling. Do not teach private hooks yet. |
| Sources | Explain definitions/fresh factories versus existing instances once. Preserve per-element independence and existing-source sharing. Mark per-hook independence as pending implementation and the factory-safety decision. |
| Views | Preserve current shared `const ctx = useIgnite(core)` examples. Do not remove machine-backed headless preparation or claim independent hook lifetimes until slice B is implemented. |
| Ownership | Apply shared retention until `core.dispose()` and rejection of every explicit `cleanup` value. Separate view unsubscription, core resource disposal and application-owned native shutdown. |
| API/reference | Remove `cleanup?` from the current candidate signature/table and link the candidate migration note. Do not add a replacement lifecycle property. |
| Examples | Remove `cleanup: false` from smart-home's browser component and `cleanup: true` from voice-workbench's component. Retain their existing shutdown callers and verify their lifecycle tests. |

The local changes touch only directly contradictory lifecycle paragraphs,
a candidate migration page, and those two example configurations. Archived v2
documentation remains historical. The beta.13 migration page now labels its old
`cleanup` support historically and records the later reconnect finding.

Any future shorter-session example must create a source/core, invoke actual
shutdown with native ownership respected, then construct a fresh replacement.
Reimporting a disposed singleton is not a new session. No global owner discovery,
mandatory Provider, or disposal wrapper is implied.
