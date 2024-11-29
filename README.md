# IgniteElement

IgniteElement is a lightweight library for creating web components with support for multiple state management libraries. <br/>It allows developers to integrate Redux, MobX, or XState seamlessly while maintaining flexibility and a consistent API.

## Table of Contents

1. [Features](#features)
2. [Installation](#installation)
3. [Quickstart](#quickstart)
4. [Shared vs. Isolated Components](#shared-vs-isolated-components)
   - [Shared Components](#shared-components)
   - [Isolated Components](#isolated-components)
5. [Generating Stylesheets](#generating-stylesheets)
   - [Setting Up Tailwind CSS](#setting-up-tailwind-css)
   - [Example Script](#example-script)
   - [Using Custom Styles with IgniteElement](#using-custom-styles-with-igniteelement)
6. [Contributing](#contributing)
   - [Running Examples Locally](#running-examples-locally)
7. [TODO](#todo)

## Features

- **Plug-and-Play Adapters**: Easily integrate Redux, MobX, or XState with prebuilt adapters.
- **State Management Modes**: Support for shared and isolated state components.
- **Flexible Style Support**: Inject global styles or define custom styles for your components.
- **Modern Templating**: Use `lit-html` for dynamic, efficient templates.
- **Developer Friendly**: A consistent API for managing state across different libraries.

## Installation

Install ignite-element along with your preferred state management library: `npm install ignite-element xstate`

## Quickstart

Here’s how to set up your first IgniteElement project:

1. Install dependencies:

   ```bash
   npm install ignite-element xstate
   ```

2. Create a state machine (for example, counterMachine):
3. Initialize your component with `igniteCore`:

```typescript
import { html } from "lit-html";
import { igniteCore } from "ignite-element";
import counterMachine from "./counterMachine";

const igniteElement = igniteCore({
  adapter: "xstate",
  source: counterMachine,
});
```

4. Define a web component:

```typescript
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

5. Add the component to your HTML:

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

### Shared vs. Isolated Components

IgniteElement offers two approaches to state management for web components

| Feature                | Shared Components                        | Isolated Components                          |
| ---------------------- | ---------------------------------------- | -------------------------------------------- |
| **State Sharing**      | Shared across all instances              | Independent for each instance                |
| **Use Case**           | Global state like shopping cart or theme | Local state like form inputs                 |
| **Performance Impact** | Updates re-render all shared components  | Updates only re-render the specific instance |

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

## Generating Stylesheets

IgniteElement allows developers to inject styles into web components, supporting both Tailwind CSS and custom styles. <br />Below is an example of setting up Tailwind CSS to generate your styles.

For detailed setup instructions, refer to the [Tailwind CSS Installation Guide](https://tailwindcss.com/docs/installation).

### Setting Up Tailwind CSS

To get started with Tailwind CSS:

Install Tailwind and its dependencies:

```bash
npm install -D tailwindcss postcss autoprefixer
```

Initialize Tailwind Configuration (optional):

```bash
npx tailwindcss init
```

Create a styles.css file:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Example Script

In your package.json, add a script to build your Tailwind CSS stylesheet:

```json
"scripts": {
  "build:css": "npx tailwindcss -i ./styles.css -o ./dist/styles.css"
}
```

This script compiles styles.css into a distributable file (`./dist/styles.css`). <br/>
**You can customize this path, but ensure that the `styles.paths` in `igniteCore` matches the updated location.**

Build your CSS:

```bash
npm run build:css
```

The resulting `dist/styles.css` file will include all your Tailwind-generated styles.

**Important:** Ensure that you have run the `build:css` script to generate the stylesheet before referencing it in `styles.paths`. The file must exist at the specified location for IgniteElement to inject it into the components.

### Using Custom Styles with IgniteElement

**Tip:** You can specify global styles via `styles.paths` and define additional scoped styles using `styles.custom` in the `igniteCore` configuration:

When configuring IgniteElement, you can specify the paths to your global CSS styles and define additional inline styles directly in the `igniteCore` configuration:

**Note:** If `styles.paths` and `styles.custom` are not provided, no additional styles will be applied to your components. Ensure you configure at least one of these options to style your components effectively.

**Important:** If you are using Tailwind, you must ensure the `styles.paths` property points to your compiled Tailwind CSS file (e.g., `dist/styles.css`) for ignite-element to properly inject the styles.

```typescript
const igniteElement = igniteCore({
  adapter: "xstate",
  source: counterMachine,
  styles: {
    paths: ["./dist/styles.css"],
    custom: `
      .custom-margin {
        margin-bottom: 3rem;
      }
    `,
  },
});
```

## Contributing

Contributions are welcome! Please follow these steps to get started:

Clone the repository

```bash
git clone https://github.com/0xjcf/Ignite-Element.git
```

Install dependencies:

```bash
npm install
```

**Note:** Ensure you are using a compatible Node.js version as specified in the `package.json` or `.nvmrc` file.

Build the project:

```bash
npm run build
```

### Running Examples Locally

Ensure you install the dependencies for examples before running any of the example scripts

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

### Examples

You can find example implementations for [XState](./src/examples/xstate), [Redux](./src/examples/redux), and [MobX](./src/examples/mobx) in the `src/examples` directory of the repository.

## TODO

- [ ] Create Redux example
- [ ] Create Mobx example
- [ ] Add tests
