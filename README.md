# ignite-element

[![CI Build](https://github.com/0xjcf/ignite-element/actions/workflows/ci.yml/badge.svg)](https://github.com/0xjcf/ignite-element/actions/workflows/ci.yml)  
[![npm version](https://img.shields.io/npm/v/ignite-element.svg)](https://www.npmjs.com/package/ignite-element)  
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)  
[![codecov](https://codecov.io/github/0xjcf/ignite-element/graph/badge.svg?token=6SSFPOV9J8)](https://codecov.io/github/0xjcf/ignite-element)

---

## **Overview**

Ignite-Element is a lightweight library for building reusable, state-driven, and framework-agnostic web components. Built on web standards like **Custom Elements**, **Shadow DOM**, and **ES Modules**, Ignite-Element empowers developers to create modular and scalable UIs with minimal boilerplate.

---

## **Quick Links**

- **[Documentation](https://joseflores.gitbook.io/ignite-element/)**  
  Comprehensive guides, examples, and best practices.
- **[Installation](#installation)**  
  Get started in seconds.
- **[Examples](#examples)**  
  Real-world integrations with **XState**, **Redux**, and **MobX**.
- **[Contributing](#contributing)**  
  Learn how to contribute and improve Ignite-Element.

---

## **Features**

- **State Management Made Easy**: Supports shared and isolated state components using state libraries like **XState**, **Redux**, and **MobX**.
- **Reusable Web Components**: Built on modern web standards to ensure compatibility and performance.
- **Flexible Styling**: Inject global styles or use scoped styles for each component.
- **TypeScript Support**: Provides type safety for seamless integration with your codebase.
- **No Dependencies**: Ignite-Element relies purely on web standards, ensuring a lightweight and fast runtime.

---

## **Installation**

Install Ignite-Element with your preferred state management library:

`npm install ignite-element xstate`

Or, for **Redux**:

`npm install ignite-element @reduxjs/toolkit`

Or, for **MobX**:

`npm install ignite-element mobx`

---

## **Getting Started**

Ignite-Element supports shared and isolated state components. Here’s a quick example:

```javascript
import { igniteCore } from "ignite-element";
import counterMachine from "./counterMachine"; // Your XState machine

const igniteElement = igniteCore({
  adapter: "xstate", // Choose "redux" or "mobx" if using those libraries
  source: counterMachine,
});

// Define a shared component
igniteElement.shared("counter-display", (state, send) => {
  return html`
    <div>
      <h3>Count: ${state.count}</h3>
      <button @click=${() => send({ type: "INCREMENT" })}>Increment</button>
    </div>
  `;
});
```

---

## **Examples**

Explore real-world examples of Ignite-Element in action:

- [**XState + Tailwind CSS**](./src/examples/xstate): State machine integration using XState, with Tailwind CSS for styling.
- [**Redux + Bootstrap**](./src/examples/redux): Redux-based state management, styled with Bootstrap.
- [**MobX + Custom Styles**](./src/examples/mobx): A reactive example using MobX and custom global styles.

To run these examples locally, use the following commands:

- **XState Example**:
  `pnpm run examples:xstate`

- **Redux Example**:
  `pnpm run examples:redux`

- **MobX Example**:
  `pnpm run examples:mobx`

---

## **Styling with Ignite-Element**

Ignite-Element offers flexible styling options:

1. **Global Styles**: Apply global styles across all components using `setGlobalStyles`.
2. **Scoped Styles**: Define encapsulated styles within each component.
3. **Dynamic Styles**: Adjust styles dynamically based on component state.

Example: Using `setGlobalStyles` for Tailwind CSS:

```javascript
import { setGlobalStyles } from "ignite-element";

setGlobalStyles("./styles/tailwind.css");
```

For more details, see the [Styling section](https://joseflores.gitbook.io/ignite-element/styling).

---

## **Documentation**

For the full documentation, visit the Ignite-Element GitBook:  
👉 **[https://joseflores.gitbook.io/ignite-element/](https://joseflores.gitbook.io/ignite-element/)**

---

## **Contributing**

Contributions are welcome! To get started:

1. Fork the repository and clone your fork:
   ```bash
   git clone https://github.com/<your-username>/ignite-element.git
   cd ignite-element
   ```

2. Install dependencies:
   `pnpm install`

3. Create a feature branch:
   `git checkout -b feature/my-new-feature`

4. Run tests:
   `pnpm test`

5. Submit a pull request with a clear description.

For detailed guidelines, see the [Contributing section](https://joseflores.gitbook.io/ignite-element/contributing).

---

## **Feedback**

Your feedback helps Ignite-Element grow! Share your thoughts:

- Open an issue on [GitHub](https://github.com/0xjcf/Ignite-Element/issues)
- Start a discussion on [GitHub Discussions](https://github.com/0xjcf/Ignite-Element/discussions)
