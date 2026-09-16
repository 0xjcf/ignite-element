---
"ignite-element": minor
---

Forward declared native source events through each connected Web Component's
existing DOM event surface. Keep headless native delivery and flat payloads.
Evaluate effects once per core/source instance and deliver each notification
to eligible consumers. Infer native emitted names to reject competing effect
emissions and incompatible public payload declarations; warn in development
when both producers are observed at runtime without changing delivery.

Infer precise Actor-Web native channels even when command and emission types
overlap. Keep inferred headless events distinct from the explicitly declared
component event map: undeclared native events do not advertise React callbacks.

This is unreleased. Existing beta.13 artifacts are unchanged. If an effect
re-emits an event already produced by the source, keep one production rule:
retain the declaration for public discovery/handlers and remove that effect
emission. Use a different effect-only name for a state-derived notification.

Shared effects activate on runtime use or committed subscriptions/connections,
then retain their baseline through zero-view gaps until core disposal. Isolated
instances retain separate lifetimes. Migrate per-view callbacks and baselines
to framework lifecycle facilities. Queued effects are not a framework commit
barrier; core-owned failures use the console fallback, not a host error hook.
