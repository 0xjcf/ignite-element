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

## Using with XState

```bash
npm install xstate ignite-element
```


#### Example Counter created with XState
```typescript
// counter.ts
import { html } from "lit-html";
import { igniteElementFactory } from "ignite-element";
import counterMachine from "./counterMachine";

const igniteElement = igniteCore({
  adapter: "xstate",
  source: counterMachine,
});

igniteElement.shared("my-counter", (state, send) => {
  return html`
    <div>
      <span>${state.context.count}</span>
      <button @click=${() => send({ type: "DEC" })}>-</button>
      <button @click=${() => send({ type: "INC" })}>+</button>
    </div>
  `;
});
```


#### Example HTML

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script type="module" src="./xstateExample.ts"></script>
    <title>XState Example</title>
  </head>
  <body>
    <!-- XState Component -->
    <my-counter></my-counter>
  </body>
</html>
```

## Shared vs. Isolated Components

IgniteElement offers two approaches to state management for web components

### Shared Components

Shared componenents share the same state across all instances. This is useful for global states like shopping carts or user session data, where every component reflects the same underlying state.

- <b>Example Use Case:</b>: A shopping cart summary that updates across the entire app.

```typescript
igniteElement.shared("cart-summary", (state, send) => {
  return html`
    <div>
      <h3>Cart Summary</h3>
      <p>Total Items: ${state.totalItems}</p>
      <button @click=${() => send({ type: "CLEAR_CART" })}>Clear Cart</button>
    </div>
  `;
});
```

### Isolated Components

Isolated components have independent state management. Each component instance operates in its own scope, ensuring no interference with other components.

- <b>Example Use Case:</b>: Independent product quantity selectors for an e-commerce site.

```typescript
igniteElement.isolated("product-counter", (state, send) => {
  return html`
    <div>
      <h3>Product Counter</h3>
      <p>Quantity: ${state.quantity}</p>
      <button @click=${() => send({ type: "DECREASE" })}>-</button>
      <button @click=${() => send({ type: "INCREASE" })}>+</button>
    </div>
  `;
});
```
