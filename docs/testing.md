# Testing Ignite Element

Ignite Element now supports deterministic headless testing through the same runtime that powers `execute()`, `getSnapshot()`, `on()`, and `watchSnapshot()`.

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
  effects: ({ emit, select }) => {
    const isOn = select((snapshot) => snapshot.matches("on"));
    if (!isOn.changed) return;
    emit({ type: "toggled", isOn: isOn.current });
  },
});

(await igniteTest({ component })
  .given({ value: "off" })
  .when({ command: "toggle" }))
  .expectSnapshot({ value: "on" })
  .expectEvent({ type: "toggled", isOn: true });
```

The helper:

- asserts against the current runtime snapshot with `given(...)`
- executes a typed command with `when({ command, input? })`
- inspects the deterministic post-command snapshot with `expectSnapshot(...)`
- verifies emitted effects with `expectEvent(...)` or `expectEvents(...)`

Because it wraps the headless runtime, this style stays aligned with effects-based event emission and remains replay-friendly.

## Deterministic effects notes

- A new host/runtime seeds `prevSnapshot` from the current adapter state.
- Historical transitions are not replayed when a new host attaches.
- The first subscription notification establishes the baseline and does not run `effects(...)`.
- For mounted elements, effects run before that host's next render for the same transition.
