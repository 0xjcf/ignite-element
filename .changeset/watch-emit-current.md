---
"ignite-element": major
---

BREAKING (beta): `core.watch` delivers the current derived states on subscribe, with `previous === undefined`. This matches RxJS `BehaviorSubject` and XState `actor.subscribe`. Pass `{ emitCurrent: false }` to keep transition-only observation. Handlers that also call themselves with `get('states')` will double-apply; delete that seed. `previous` on later deliveries is the last value delivered to that subscription. Ignite still does not add global deep equality. `observe` and `until` follow the same initial delivery, so `until` no longer seeds a second time. Targets 3.0.0-beta.18.
