# Design: Accessibility by default

## Status

Proposed documentation for the Ignite Element v3 beta design window. This file
describes the accessibility contract that surrounds the projection runtime and
the existing headless APIs.

## Core position

Ignite should be accessibility-first by default, but not by introducing a
parallel accessibility DSL. The correct default is:

1. Start with native HTML semantics.
2. Add ARIA only where native semantics are insufficient.
3. Model the behavior facts that every consumer needs.
4. Verify those facts headlessly.
5. Verify final browser and assistive behavior in rendered DOM.

That keeps one behavior contract for browser UI, voice interfaces, screen
reader-oriented summaries, and agent tools.

## Native-first, not callback-first

Accessibility is primarily realized in the DOM layer that consumes the runtime:

- buttons stay buttons,
- labels stay native `<label>` associations,
- validation messages stay explicit text in the DOM,
- disabled and busy states stay native attributes when available.

Ignite therefore should not introduce a mandatory top-level `accessibility:`
callback that duplicates `view`, command metadata, and event semantics. The
existing model already has the right places for accessibility facts:

- `view` and `getView()` expose derived state,
- `getSchema()` exposes commands and metadata,
- `canExecute()` exposes dynamic availability,
- `execute()` and `on(...)` expose outcomes,
- projection selection can resolve channel-specific summaries over those facts.

## Behavior facts that matter

An accessibility-first component should make these facts explicit in its
behavior contract:

- control labels and helper text,
- command descriptions and input shapes,
- dynamic availability and disabled reasons,
- validation state and error text,
- focus intent,
- announcement intent,
- status summaries that do not require DOM traversal.

The contract should describe the state, not simulate the browser accessibility
tree inside Node.

## Example: behavior facts without a second DSL

```ts
import { igniteCore } from "ignite-element/xstate";

const thermostat = igniteCore({
  source: thermostatMachine,
  view: ({ snapshot }) => ({
    target: snapshot.context.target,
    statusLabel: snapshot.context.isSaving ? "Saving target" : "Ready",
    targetLabel: "Target temperature",
    targetHint: "Choose a value between 58 and 82 degrees.",
    canSave: snapshot.can({ type: "SAVE_TARGET" }),
    disabledReason: snapshot.can({ type: "SAVE_TARGET" })
      ? null
      : "Connect to the thermostat before saving.",
    announceOnSave: snapshot.context.lastSavedAt !== null,
  }),
  commands: ({ actor, command }) => ({
    saveTarget: command(
      (target: number) => actor.send({ type: "SAVE_TARGET", target }),
      {
        description: "Save the target temperature.",
        input: command.number({ minimum: 58, maximum: 82 }),
        canExecute: ({ snapshot }) => snapshot.can({ type: "SAVE_TARGET" }),
      },
    ),
  }),
});
```

Nothing new is invented here. The runtime already carries the facts that a DOM
projection, a voice summary, and an agent tool need to stay aligned.

## Headless facts vs rendered guarantees

| Concern | Headless runtime can prove | Rendered DOM/browser must prove |
| --- | --- | --- |
| Command existence and descriptions | Yes via `getSchema()` | No |
| Dynamic availability | Yes via `canExecute()` | No |
| Validation state and status summaries | Yes via `getView()` or projection facts | No |
| Focus or announcement intent exists | Yes as explicit view/projection facts | No |
| Computed accessible name/description | No | Yes |
| Focus order, trap, and restoration | No | Yes |
| Keyboard interaction details | No | Yes |
| DOM relationships such as `for`, `aria-describedby`, `aria-controls` | No | Yes |
| Live-region timing and assistive tech behavior | No | Yes |
| CSS visibility and visually-hidden correctness | No | Yes |

The practical rule is simple: headless verification proves contract quality;
rendered verification proves browser accessibility.

## Voice, assistive, text, and agent consumers

The same behavior facts should serve multiple consumers:

- DOM projections turn them into native controls and text.
- Voice projections turn them into prompts and confirmations.
- Assistive summaries turn them into compact status facts.
- Agent projections turn them into tool-facing responses.

This is why projection selection is useful: each channel can ask for a known
representation while staying grounded in the same runtime contract.

## Rejected approaches

### DOM scraping as the primary agent path

Rejected because it is fragile, non-deterministic, and conflates rendered output
with the behavior contract. Agents should start from `getSchema()`, `getView()`,
`canExecute()`, and typed projection facts before any selector work.

### Accessibility-tree simulation in Node

Rejected because Node cannot faithfully prove browser accessibility behavior,
accessible-name computation, focus order, or assistive technology integration.
Those are browser responsibilities.

### First-party component primitives as the core answer

Rejected for the core runtime because it makes Ignite own a much larger styling
and maintenance surface without solving the underlying contract problem.
Optional examples and helpers can still demonstrate good native patterns.

## Verification ladder

1. Behavior unit tests verify source logic and state transitions.
2. Headless runtime checks verify `getSchema()`, `getView()`, `canExecute()`,
   emitted events, and typed projection facts.
3. Rendered DOM tests verify role queries, accessible names, helper text,
   keyboard flows, focus movement, and live-region output in a browser-capable
   environment.

Each rung proves something different. Skipping rendered checks because headless
facts look correct is a category mistake.

## Practical authoring guidance

- Prefer native `<button>`, `<input>`, `<select>`, `<fieldset>`, `<label>`,
  `<output>`, and `<form>` before ARIA roles.
- Use ARIA to supplement missing semantics, not to recreate native controls.
- Keep disabled reasons, validation text, and status summaries in `view` or
  projection facts so every consumer can reason over them.
- Use command metadata descriptions and input schemas to keep prompts and forms
  aligned.
- Treat headless accessibility facts as prerequisites for good UI, not as proof
  of browser conformance.

## Decision

Ignite's accessibility story should be native-first and contract-first:

- no mandatory accessibility callback,
- no raw generated UI as the default agent path,
- no headless claims that exceed what Node can prove,
- and no actor-web ownership drift into Ignite.

The runtime owns behavior facts. The rendered DOM owns final accessibility
semantics.
