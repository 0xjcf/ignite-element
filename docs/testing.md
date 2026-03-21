# Testing Ignite Element

Ignite Element now supports deterministic headless testing through the same runtime that powers `execute()`, `getState()`, and `subscribe()`.

## Scenario helper

```ts
import { test as igniteTest } from "ignite-element";
import { igniteCore } from "ignite-element/xstate";

const component = igniteCore({
  source: machine,
  commands: ({ actor }) => ({
    toggle: () => actor.send({ type: "TOGGLE" }),
  }),
  events: (event) => ({
    toggled: event<{ isOn: boolean }>(),
  }),
  effects: (snapshot, prevSnapshot, { emit }) => {
    if (snapshot.value === prevSnapshot.value) return;
    emit("toggled", { isOn: snapshot.matches("on") });
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
