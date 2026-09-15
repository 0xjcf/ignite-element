---
"ignite-element": minor
---

Forward declared native source events through each connected Web Component's
existing DOM event surface. Keep headless native delivery, flat payloads, and
per-projection effects. Infer native emitted names to reject competing effect
emissions and incompatible public payload declarations; warn in development
when both producers are observed at runtime without changing delivery.

This is unreleased. Existing beta.13 artifacts are unchanged. If an effect
re-emits an event already produced by the source, keep one production rule:
retain the declaration for public discovery/handlers and remove that effect
emission. Use a different effect-only name for a state-derived notification.
