---
"ignite-element": major
---

BREAKING (beta): `core.watch` delivers the current derived states on subscribe, with `previous === undefined`. This matches RxJS `BehaviorSubject` and XState `actor.subscribe`. Pass `{ emitCurrent: false }` to keep transition-only observation. That opt-out skips the initial call but still records the subscribe-time states as an undelivered baseline, so the first transition's `previous` is that baseline. After a value has been delivered, `previous` is the last value delivered to that subscription. Handlers that also call themselves with `get('states')` will double-apply; delete that seed. Ignite still does not add global deep equality. `observe` and `until` follow the same initial delivery, so `until` no longer seeds a second time. Targets 3.0.0-beta.18.
