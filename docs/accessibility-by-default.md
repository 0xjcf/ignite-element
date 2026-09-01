# Design: Accessibility by default

## Status

Accepted replacement guidance for the Ignite Element v3 beta design window.
This document now aligns with the validated projection-document runtime instead
of the rejected registry design.

## Core position

Ignite should be accessibility-first by default, but not by introducing a
parallel accessibility DSL or by making a model generate DOM.

The correct default is:

1. Start with native HTML semantics.
2. Keep behavior facts explicit in `view`, commands, and validated semantic
   documents.
3. Use headless runtime checks to prove those facts are coherent.
4. Use rendered DOM checks to prove browser accessibility behavior.

That keeps one behavior contract for browser UI, voice, assistive summaries, and
agent tooling.

## Runtime facts before DOM

Accessibility begins in the runtime contract, not in a post-hoc DOM scrape.
Ignite already exposes the facts most accessible interfaces need:

- derived state through `view` and `getStates()`,
- command descriptions and input shapes through `getSchema()`,
- dynamic availability through `canExecute()`,
- command results and emitted events through `execute()` and `on(...)`,
- validated semantic projection state through actor-owned
  `ProjectionDocument` data.

Those facts are channel-neutral. A DOM renderer, a speech target, and a text
summary should all consume the same durable source of truth.

## Semantic documents, not raw generated UI

When non-trivial presentation needs to be shared across channels, Ignite uses
validated semantic nodes instead of raw generated UI code.

This matters for accessibility because it keeps the contract explicit:

- a checklist is a checklist,
- a form is a form,
- an action is a reference to an existing command,
- a status block is structured text,
- a speech utterance is a durable request with stable identity.

Ignite rejects raw JSX, JavaScript, imports, event handlers, DOM references,
and arbitrary executable strings in projection state. That prevents "accessible"
output from depending on generated code that cannot be validated or replayed.

## Command-backed action semantics

Accessible interaction still has to respect the command surface.

Command-backed action nodes must:

- resolve to an existing command in `getSchema().commands`,
- validate any payload against the declared command schema,
- check current availability through `canExecute()` at commit time.

This keeps accessible controls aligned with the same executable contract agents
and headless tests already use.

## Native-first DOM mapping

Rendered accessibility remains a DOM concern. The runtime should supply facts;
the DOM renderer should express those facts with native elements first:

- buttons stay buttons,
- labels stay native `<label>` associations,
- status summaries stay text,
- disabled and busy states stay native attributes where possible.

ARIA supplements native semantics when needed. It should not become the primary
runtime contract.

Asynchronous save failures need their own assertive announcement, such as a
`role="alert"` error node, rather than relying on a polite status update. Rendered
browser tests must cover the `SAVE_FAILURE` flow while focus remains on the
triggering control and verify the announcement separately from headless facts.

## Example: runtime facts without a second DSL

```ts
import { igniteCore } from "ignite-element/xstate";
import { thermostatMachine } from "./thermostatMachine";

const thermostat = igniteCore({
  source: thermostatMachine,
  states: (snapshot) => ({
    target: snapshot.context.target,
    targetLabel: "Target temperature",
    targetHint: "Choose a value between 58 and 82 degrees.",
    statusLabel: snapshot.context.isSaving ? "Saving target" : "Ready",
    disabledReason: snapshot.can({
      type: "SAVE_TARGET",
      target: snapshot.context.target,
    })
      ? null
      : "Connect to the thermostat before saving.",
  }),
  commands: ({ actor, command }) => ({
    saveTarget: command(
      (target: number) => actor.send({ type: "SAVE_TARGET", target }),
      {
        description: "Save the target temperature.",
        input: command.number({ minimum: 58, maximum: 82 }),
        canExecute: ({ snapshot }) => snapshot.can({
          type: "SAVE_TARGET",
          target: snapshot.context.target,
        }),
      },
    ),
  }),
});
```

Nothing new is invented here. The runtime already carries the facts that a DOM
projection, assistive summary, speech output, and agent tool need to stay
aligned.

## Speech and announcement boundaries

Speech is not just another DOM diff.

- DOM and text committers are change-driven.
- Speech is request-driven.
- A speech request must be written into durable state first.
- Each utterance needs stable identity so rebinding does not replay it.
- Acknowledgement and deduplication are part of the runtime contract.

This matters for accessibility because announcements must be intentional and
testable, not accidental side effects of repeated reads.

## Headless facts vs rendered guarantees

| Concern | Headless runtime can prove | Rendered DOM/browser must prove |
| --- | --- | --- |
| Command existence and descriptions | Yes via `getSchema()` | No |
| Dynamic availability | Yes via `canExecute()` | No |
| Semantic document validity | Yes | No |
| Action payload validity | Yes | No |
| Speech request identity and dedupe | Yes | No |
| Status summaries and disabled reasons | Yes via `getStates()` and semantic documents | No |
| Computed accessible name/description | No | Yes |
| Focus order, trap, and restoration | No | Yes |
| Keyboard interaction details | No | Yes |
| DOM relationships such as `for` or `aria-describedby` | No | Yes |
| Live-region timing and assistive tech behavior | No | Yes |
| CSS visibility and visually-hidden correctness | No | Yes |

The practical rule is simple: headless verification proves contract quality;
rendered verification proves browser accessibility.

## Rejected approaches

### DOM scraping as the primary agent path

Rejected because it is fragile and couples agent logic to rendered output rather
than the behavior contract.

### Accessibility-tree simulation in Node

Rejected because Node cannot faithfully prove browser accessibility semantics,
focus order, or assistive technology integration.

### A mandatory accessibility callback

Rejected because it duplicates `view`, command metadata, and semantic document
state with a second authoring surface.

### Raw model-authored UI

Rejected because generated JSX or DOM fragments are not a safe or durable
accessibility contract.

## Decision

Ignite's accessibility story is native-first and contract-first:

- no mandatory accessibility callback,
- no raw generated UI as the default agent path,
- no public projection registry,
- no headless claims that exceed what Node can prove,
- and no drift of actor or provider ownership into Ignite core.

The runtime owns behavior facts and validated semantic documents. The rendered
DOM owns final accessibility semantics.
