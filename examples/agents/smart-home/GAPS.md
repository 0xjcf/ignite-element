# igniteTools gaps — found dogfooding the headless smart-home agent (Phase B)

Building a real agent loop against `getSchema()` / `execute()` / `igniteTools` +
the Anthropic adapter surfaced these. Ordered by impact. Each is a candidate
follow-up; none blocks the example (the loop works headless today).

## 1. ✅ FIXED — the tool result now carries the derived view, not just the snapshot

**Was:** `ToolObservation = { snapshot, events }` carried only `getSnapshot()` (raw
machine context), so the model never saw the **view** (the derived read-model:
`lightsOn`, `allDoorsLocked`, `activeScene`) the design says agents should ground
on — a consumer had to inject `getView()` out-of-band.

**Fixed in this PR:** `ToolObservation` is now `{ snapshot, view, events }`.
`igniteTools` binds `getView` (added to the `IgniteToolsRuntime` surface) and
captures it post-command, so every `run()` observation — and thus every
`tool_result` the adapter serializes — carries the view. The agent grounds on the
read-model out of the box. (See `result.trace[*].view` in the scripted test.)

## 2. No availability gating (`canExecute`)

The manifest offers **every** command regardless of state — `unlockDoor` is
offered while the `away` scene is armed, `runScene` while a scene is already
active. A smart home wants state-dependent availability ("don't offer unlock
while armed"). `igniteTools` already composes with `canExecute` *if present*, but
the runtime doesn't implement it yet. → tracked: `canExecute` task
(`task-1781798486122`). Until then, gating must live inside command logic as an
`ExecuteFailed`/validation, not as manifest availability.

## 3. ✅ FIXED — `observe()` streams events and view changes between acts

**Was:** the agent saw `result.value.events` emitted **during** `run()`, but
there was no channel to observe events/view **between** acts. The loop could not
react to anything that happened outside a command window.

**Fixed in this PR:** `igniteTools(...).observe(handler)` now streams
schema-declared events and derived view transitions with a standard
`unsubscribe()` handle, so the agent loop can stay on one act → observe → act
surface instead of calling runtime `on()` / `watchView()` directly.

## 4. Async / long-running effects (act+ack vs settle) are untested here

Scenes in this example apply **synchronously**, so `run()`'s acknowledgement
snapshot already reflects the full effect. The interesting contract case — `run()`
returns at acknowledgement while the effect settles over time — needs a genuinely
async scene (real-time transition) or a remote actor. Phase C (terminal↔browser
over a transport) is the natural place to exercise it; it will show whether a
bounded `settle` opt-in on `execute()` is warranted (currently deferred).

## 5. Scalar `value`-wrapping costs LLM legibility (known Option D trade-off)

A single-arg command (`lockDoor(door)`) is presented to the model as
`{ value: "front" }`, not `{ door: "front" }`. This is correct and collision-free
(Option D), but the generic `value` key is less self-documenting than the real
parameter name — the model has slightly less signal about what it's filling in.
Not a bug; worth weighing for prompt legibility (e.g., an optional param-name
hint in the description, or a future per-command label).

## 6. Array inputs not yet exercised (coverage)

The command set covers object / scalar-enum / no-arg inputs. An array-input
command (e.g. `dimRooms(rooms: Room[])`) would round out manifest + adapter
coverage for the array JSON-Schema shape and its scalar `value`-wrap.
