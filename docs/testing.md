# Testing Ignite Element

Ignite Element now supports deterministic headless testing through the same runtime that powers `execute()`, `getState()`, `on()`, and `watch()`.

## Scenario helper

```ts
import { test as igniteTest } from "ignite-element";
import { igniteCore } from "ignite-element/xstate";

const component = igniteCore({
  source: machine,
  view: ({ snapshot }) => ({
    isOn: snapshot.matches("on"),
  }),
  commands: ({ actor }) => ({
    toggle: () => actor.send({ type: "TOGGLE" }),
  }),
  events: (event) => ({
    toggled: event<{ isOn: boolean }>(),
  }),
  effects: (_snapshot, _prevSnapshot, { emit, select }) => {
    const isOn = select((snapshot) => snapshot.matches("on"));
    if (!isOn.changed) return;
    emit("toggled", { isOn: isOn.current });
  },
});

igniteTest(component)
  .given("off")
  .when("toggle")
  .expectState("on")
  .expectEvent("toggled", { isOn: true });
```

The helper:

- asserts against the current runtime state with `given(...)`
- executes a typed command with `when(...)`
- inspects the deterministic post-command state with `expectState(...)`
- verifies emitted effects with `expectEvent(...)` or `expectEvents(...)`

Because it wraps the headless runtime, this style stays aligned with effects-based event emission and remains replay-friendly.

## Deterministic effects notes

- A new host/runtime seeds `prevSnapshot` from the current adapter state.
- Historical transitions are not replayed when a new host attaches.
- The first subscription notification establishes the baseline and does not run `effects(...)`.
- For mounted elements, effects run before that host's next render for the same transition.
