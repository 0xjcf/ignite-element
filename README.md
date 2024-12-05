# ignite-element

## Table of Contents

1. [Features](#features)
2. [Installation](#installation)
3. [Quickstart](#quickstart)
   - [Examples](#examples)
     - [XState Example](./src/examples/xstate)
     - [Redux Example](./src/examples/redux)
     - [MobX Example](./src/examples/mobx)
   - [Shared vs. Isolated Components](#shared-vs-isolated-components)
4. [Custom Styles](#using-custom-styles-with-igniteelement)
5. [Contributing](#contributing)
6. [Feedback](#feedback)

## Features

- **Plug-and-Play Adapters**: Easily integrate Redux, MobX, or XState with prebuilt adapters.
- **State Management Modes**: Support for shared and isolated state components.
- **Flexible Style Support**: Inject global styles or define custom styles for your components.
- **Modern Templating**: Use `lit-html` for dynamic, efficient templates.
- **Developer Friendly**: A consistent API for managing state across different libraries.

## Quickstart

Here’s how to set up your first ignite-element project:

Install `ignite-element` with your preferred state management library:

```bash
npm install ignite-element redux @reduxjs/toolkit
```

Or for XState:

```bash
npm install ignite-element xstate
```

### Examples:

- [XState Example](./src/examples/xstate): Demonstrates state machine integration using XState.
- [Redux Example](./src/examples/redux/): Shows how to manage state with Redux.
- [MobX Example](./src/examples/mobx/): A reactive state management example using MobX.

### Shared vs. Isolated Components

ignite-element offers two approaches to state management for web components

| Feature                | Shared Components                        | Isolated Components                          |
| ---------------------- | ---------------------------------------- | -------------------------------------------- |
| **State Sharing**      | Shared across all instances              | Independent for each instance                |
| **Use Case**           | Global state like shopping cart or theme | Local state like form inputs                 |
| **Performance Impact** | Updates re-render all shared components  | Updates only re-render the specific instance |

### Initializing ignite-element

Both shared and isolated components require initializing an instance of `igniteElement`. For example:

```typescript
import { igniteCore } from "ignite-element";
import counterMachine from "./stateMachine"; // or Redux store

const igniteElement = igniteCore({
  adapter: "xstate", // Replace with "redux" for Redux
  source: counterMachine, // Replace with Redux store for Redux
});
```

### Shared Components

Shared components share the same state across all instances. This is useful for global states like shopping carts or user session data, where every component reflects the same underlying state.

<b>Example Use Case:</b>: A shopping cart summary that updates across the entire app.

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

---

### Isolated Components

Isolated components have independent state management. Each component instance operates in its own scope, ensuring no interference with other components.

<b>Example Use Case:</b>: Independent product quantity selectors for an e-commerce site.

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

### Styling with ignite-element

**Note:** If using preprocessed styles (e.g., SCSS or Tailwind CSS), ensure the styles are compiled to a distributable `.css` file before referencing it in `styles.paths`. For example, use a build script like:

```bash
sass ./src/styles.scss ./dist/styles.css
```

And add the path

```typescript
const igniteElement = igniteCore({
  adapter: "xstate",
  source: counterMachine,
  styles: {
    paths: ["./dist/styles.css"],
  },
});
```

**Note:** If `styles.paths` and `styles.custom` are not provided, no additional styles will be applied to your components. Ensure you configure at least one of these options to style your components effectively.

**Important:** If you are using Tailwind, you must ensure the `styles.paths` property points to your compiled Tailwind CSS file (e.g., `dist/styles.css`) for ignite-element to properly inject the styles.

```typescript
const igniteElement = igniteCore({
  adapter: "xstate",
  source: counterMachine,
  styles: {
    custom: `
      .custom-margin {
        margin-bottom: 3rem;
      }
    `,
  },
});
```

### Best Practices for Styling

- Use `styles.paths` for global stylesheets like Tailwind or SCSS.
- Use `styles.custom` for inline styles shared across multiple components.
- Combine `styles.paths` and `styles.custom` to create reusable, flexible designs.

<!-- // TODO add link to mobx example for styling -->

## Contributing

Contributions are welcome! Please follow these steps to get started:

Clone the repository

```bash
git clone https://github.com/0xjcf/Ignite-Element.git
```

Install dependencies:

```bash
npm i
```

**Note:** Ensure you are using a compatible Node.js version as specified in the `package.json` or `.nvmrc` file.

Build the project:

```bash
npm run build
```

### Running Examples Locally

Install dependencies for examples before running the scripts.

### Example Scripts

To explore usage examples, you can serve the example files directly:

- **XState Example**: `npm run examples:xstate`
- **Redux Example**: `npm run examples:redux`
- **MobX Example**: `npm run examples:mobx`

Before running examples, ensure you have built the project using:

```bash
npm run build
```

These commands start a local development server for each example.

## Feedback

I would love to hear your thoughts on ignite-element! If you encounter issues, have feature requests, or want to share ideas, feel free to:

- Open an issue on [GitHub](https://github.com/0xjcf/Ignite-Element/issues)
- Start a discussion on [GitHub Discussions](https://github.com/0xjcf/Ignite-Element/discussions)

Your contributions help make ignite-element better for everyone!
