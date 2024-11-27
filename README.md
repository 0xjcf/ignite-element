# IgniteElement

IgniteElement is a lightweight library for creating reusable web components with support for multiple state management libraries. <br/>It allows developers to integrate Redux, MobX, or XState seamlessly while maintaining flexibility and a consistent API.

## Features

- **Plug-and-Play Adapters**: Easily integrate and swap between Redux, MobX, or XState with prebuilt adapters.
- **Shared and Isolated State**: Toggle between shared and isolated state for components effortlessly.
- **Lit-HTML Integration**: Leverages `lit-html` for creating templates, with plans to make this part agnostic in the future.
- **Developer Friendly**: Consistent and intuitive API for all supported state management libraries.

## Running Examples Locally

To explore usage examples, you can serve the example files directly:

- **XState Example**: `npm run examples:xstate`
- **Redux Example**: `npm run examples:redux`
- **MobX Example**: `npm run examples:mobx`

These commands start a local development server for each example.

### Examples

You can find example implementations for [XState](./src/examples/xstate), [Redux](./src/examples/redux), and [MobX](./src/examples/mobx) in the `src/examples` directory of the repository.

#### Using with XState

```typescript
// counter.ts
import { html } from "lit-html";
import { igniteElementFactory } from "ignite-element";
import counterMachine from "./counterMachine";

const igniteElement = igniteCore({
  adapter: "xstate",
  source: counterMachine,
});

igniteElement.shared("my-counter-xstate", (state, send) => {
  return html`
    <div>
      <h3>Shared Counter (XState)</h3>
      <span>${state.context.count}</span>
      <button @click=${() => send({ type: "DEC" })}>-</button>
      <button @click=${() => send({ type: "INC" })}>+</button>
    </div>
  `;
});
```

#### Example Counter Machine (XState)

```typescript
// counterMachine.ts
import { assign, setup } from "xstate";

const counterMachine = setup({
  types: {
    events: {} as { type: "INC" } | { type: "DEC" },
    context: {} as {
      count: number;
    },
  },
}).createMachine({
  id: "counter",
  initial: "idle",
  context: {
    count: 0,
  },
  states: {
    idle: {
      on: {
        INC: {
          actions: assign({
            count: ({ context }) => context.count + 1,
          }),
        },

        DEC: {
          actions: assign({
            count: ({ context }) => context.count - 1,
          }),
        },
      },
    },
  },
});

export default counterMachine;
```
