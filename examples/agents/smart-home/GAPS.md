# igniteTools gaps — found dogfooding the headless smart-home agent

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

## 2. ✅ FIXED — availability gating (`canExecute`) is now on the runtime

**Was:** the manifest offered **every** command regardless of state — `unlockDoor`
while the `away` scene is armed, `runScene` while a scene is already active. A
smart home wants state-dependent availability ("don't offer unlock while armed").

**Fixed in this PR:** commands can declare `canExecute({ snapshot })` in their
metadata, `getSchema().commands[name].gated` tells `igniteTools` which commands
need dynamic availability checks, and the headless runtime exposes
`canExecute(name)` for the current boolean result. `igniteTools` already composes
with this surface, so gated unavailable commands can be omitted from the manifest
instead of failing later as `ExecuteFailed`.

## 3. ✅ FIXED — `observe()` streams events and view changes between acts

**Was:** the agent saw `result.value.events` emitted **during** `run()`, but
there was no channel to observe events/view **between** acts. The loop could not
react to anything that happened outside a command window.

**Fixed in this PR:** `igniteTools(...).observe(handler)` now streams
schema-declared events and derived view transitions with a standard
`unsubscribe()` handle, so the agent loop can stay on one act → observe → act
surface instead of calling runtime `on()` / `watchView()` directly.

## 4. ✅ FIXED — async / long-running effects are observed after act+ack

**Was:** scenes in this example applied **synchronously**, so `run()`'s
acknowledgement snapshot already reflected the full effect. The interesting
contract case — `run()` returns at acknowledgement while the effect settles over
time — was untested here.

**Fixed in this PR:** the smart-home now has a delayed `transitionScene` command
that acknowledges immediately with `pendingScene` in the view, then settles via
the runtime observation stream. The focused test proves `run()` keeps act+ack
semantics while `igniteTools(...).observe(...)` receives the later settled view
and `scene-applied` event. Phase C still owns the broader terminal↔browser
transport and cross-runtime bridge gaps.

## 5. ✅ FIXED — scalar `value`-wrapping now carries field-level hints

**Was:** a single-arg command (`lockDoor(door)`) was presented to the model as
`{ value: "front" }`, not `{ door: "front" }`. This is correct and collision-free
(Option D), but the generic `value` key is less self-documenting than the real
parameter name — the model has slightly less signal about what it's filling in.

**Fixed in this PR:** Option D stays intact (`{ value }` remains the provider
envelope), but the smart-home scalar input metadata now describes the wrapped
`value` field for door and scene commands. The Anthropic schema test asserts the
model sees a semantic description on `input_schema.properties.value`, so the
wire shape stays collision-free while the prompt surface is more legible.

## 6. ✅ FIXED — array inputs are now exercised

**Was:** the command set covered object / scalar-enum / no-arg inputs, but no
array-input command exercised the array JSON-Schema shape or its scalar
`value`-wrap.

**Fixed in this PR:** the smart-home now includes `dimRooms(rooms: Room[])`,
declared with `command.array(command.enum(ROOMS), { minItems: 1 })`. The
Anthropic schema test proves the array schema is object-wrapped under
`input_schema.properties.value`, and the round-trip test proves `toolCalls()`
unwraps `{ value: [...] }` before `run()` dims the selected rooms.

## 7. ✅ PHASE C DEMO — terminal-to-browser bridge now shares one live runtime

**Was:** Phase B proved the terminal agent could drive a DOM-free runtime, but
the browser and terminal still lived as separate validation stories. There was
no demo where the agent and a human UI acted on the same canonical home.

**Now:** `npm run demo` starts one Node-owned `createHome()` runtime, runs a
scripted `igniteTools` terminal agent against it, serves a browser
`<smart-home-bridge>` Ignite element, and links both sides with a thin WebSocket
protocol. Browser commands route back through `igniteTools.run()`, while
`igniteTools.observe()` broadcasts runtime events and view updates.

**Still a follow-up:** the bridge is intentionally example-local. It is the
actor-web-native location-transparency stand-in, not the final integration. When
actor-web exposes the durable transport contract, replace `src/bridge.ts` /
`src/server.ts` with the real actor-web source boundary and keep the Ignite UI
on the same `source`-first shape.
