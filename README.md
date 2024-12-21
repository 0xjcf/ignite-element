# ignite-element

[![CI Build](https://github.com/0xjcf/ignite-element/actions/workflows/ci.yml/badge.svg)](https://github.com/0xjcf/ignite-element/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ignite-element.svg)](https://www.npmjs.com/package/ignite-element)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Table of Contents

1. [Features](#features)
2. [Installation](#installation)
3. [Quickstart](#quickstart)
   - [Examples](#examples)
     - [XState + Tailwind CSS Example](./src/examples/xstate)
     - [Redux + Bootstrap Example](./src/examples/redux)
     - [MobX + Globlal/Custom Styles Example](./src/examples/mobx)
   - [Shared vs. Isolated Components](#shared-vs-isolated-components)
4. [Styling](#styling-with-ignite-element)
5. [Contributing](#contributing)
6. [Feedback](#feedback)

## Features

- **Plug-and-Play Adapters**: Easily integrate Redux, MobX, or XState with prebuilt adapters.
- **State Management Modes**: Support for shared and isolated state components.
- **Flexible Style Support**: Inject global styles or define custom styles for your components.
- **Modern Templating**: Use `lit-html` for dynamic, efficient templates.
- **Developer Friendly**: A consistent API for managing state across different libraries.
- **TypeScript Support**: ignite-element is written in TypeScript, providing type safety and seamless integration with the chosen state management library.
- **Dependency-Free**: ignite-element has no dependencies and solely relies on web standards that are in place.

### Web Standards

ignite-element leverages the following web standards:

1. **Custom Elements**: Define your own HTML tags and control their behavior. [Learn more about Custom Elements](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements).
2. **Shadow DOM**: Encapsulate styles and markup to ensure they do not clash with other components. [Learn more about Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM).
3. **HTML Templates**: Use `<template>` elements to define reusable chunks of HTML that can be instantiated with JavaScript. [Learn more about HTML Templates](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template).
4. **ES Modules**: Enable component import/export and maintain modularity. [Learn more about ES Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules).

These standards ensure compatibility, reusability, and performance for modern web applications.

## Quickstart

Here’s how to set up your first ignite-element project:

Install `ignite-element` with your preferred state management library:

Redux:

```bash
npm install ignite-element redux @reduxjs/toolkit
```

XState:

```bash
npm install ignite-element xstate
```

Mobx:

```bash
npm install ignite-element mobx
```

### Examples:

- [XState + Tailwind CSS Example](https://github.com/0xjcf/ignite-element/blob/main/src/examples/xstate/README.md): Demonstrates state machine integration using XState, with Tailwind CSS for styling.
- [Redux + Bootstrap Example](https://github.com/0xjcf/ignite-element/blob/main/src/examples/redux/README.md): Shows how to manage state with Redux, styled using Bootstrap.
- [MobX + Global/Custom Styles Example](https://github.com/0xjcf/ignite-element/blob/main/src/examples/mobx/README.md): A reactive state management example using MobX, featuring a custom global theme and custom component styling.

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

**Note:** If using preprocessed styles (e.g., SCSS or Tailwind CSS), ensure the styles are compiled to a distributable `.css` file before referencing it in `setGlobalStyles`. For example, use a build script like:

```bash
sass ./src/styles.scss ./dist/styles.css
```

And add the path

```typescript
import { setGlobalStyles } from "ignite-element";

setGlobalStyles("./dist/styles.css");
```

**Removed Feature:** The `styles.custom` and `styles.path` properties have been deprecated. Instead, developers are encouraged to:

- Use external stylesheets for large or shared styles.
- Use style objects with metadata for secure or CDN-hosted styles.

**Example of a Style Object:**

```typescript
import { setGlobalStyles } from "ignite-element";

setGlobalStyles({
  href: "https://cdn.example.com/styles.css",
  integrity: "sha384-abc123",
  crossorigin: "anonymous",
});
```

**Clarification on Paths:**

- **Relative Paths**: Use relative paths (e.g., `./dist/styles.css`) for stylesheets located within your project. This is most common during development or when serving styles directly from your application.
- **CDN Paths**: Use CDN paths (e.g., `https://cdn.example.com/styles.css`) for stylesheets hosted on external servers. This is ideal for production environments where performance and caching are critical. Always include `integrity` and `crossorigin` attributes for security when referencing CDN styles.

### Best Practices for Styling

- Use `setGlobalStyles` for global stylesheets like Tailwind CSS or SCSS.
- For dynamically generated or component-specific styles, use the `<style>` tag within components for small styles, or `<link>` for referencing external stylesheets.

### Summary of Benefits

| **Approach**          | **Key Benefits**                                               | **Best Use Case**                                      |
| --------------------- | -------------------------------------------------------------- | ------------------------------------------------------ |
| **Global Stylesheet** | Simplicity, reusability, scalability, and maintainability.     | Shared design systems, large projects, CSS frameworks. |
| **Style Objects**     | Secure, flexible, compatible with CDNs and remote stylesheets. | Applications requiring secure or external stylesheets. |

For more examples, see the [MobX example in the repository](https://github.com/0xjcf/ignite-element/blob/main/src/examples/mobx/README.md).

## Contributing

Contributions are welcome! Please follow these steps to get started:

Clone the repository

```bash
git clone https://github.com/0xjcf/ignite-element.git
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

## Running Examples Locally

### Example Scripts

You can explore usage examples by running the provided scripts from the root of the repository:

- **XState + Tailwind CSS Example**: `npm run examples:xstate`
- **Redux + Bootstrap Example**: `npm run examples:redux`
- **MobX + Global/Custom Styles Example**: `npm run examples:mobx`

Before running any examples, ensure the project is built by executing:

```bash
npm run build
```

These commands start a local development server for each example.

## Feedback

I would love to hear your thoughts on ignite-element! If you encounter issues, have feature requests, or want to share ideas, feel free to:

- Open an issue on [GitHub](https://github.com/0xjcf/Ignite-Element/issues)
- Start a discussion on [GitHub Discussions](https://github.com/0xjcf/Ignite-Element/discussions)

Your contributions help make ignite-element better for everyone!
