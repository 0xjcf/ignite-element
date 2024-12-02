# XState Example with ignite-element

This example demonstrates how to use ignite-element with XState, lit-html, and TailwindCSS for styling.

---

## Features

- State management with XState, showcasing shared and isolated components.
- Styling with TailwindCSS.
- Integration with ignite-element for seamless web component creation.

---

## Setup

### 1. Install Dependencies

Run the following command to install all necessary dependencies:

```bash
npm install
```

### 2. Run the Example

To start the development server:

```bash
npm run dev
```

#### Output

When running the example, you'll see:

- **Shared Counter Component**: A counter component using a shared global state.
- **Isolated Counter Component**: A counter component with isolated state for each instance.

## Styling with TailwindCSS

This example uses TailwindCSS for component styling. The `styles.css` file included the following:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Building CSS

The `build:css` script in the package.json handles compiling Tailwind styles:

```json
"scripts": {
  "build:css": "npx tailwindcss -i ./styles.css -o ./dist/styles.css"
}
```

To build the CSS:

```bash
npm run build:css
```

Ensure the `dist/styles.css` file is generated before running the example.

## ignite-element and XState

### Setting Up ignite-element with Xstate

1. **Define a State Machine**: Create an XState machine for managing the component's state.

```javascript
import { createMachine } from "xstate";

const counterMachine = createMachine({
  id: "counter",
  initial: "active",
  context: { count: 0 },
  states: {
    active: {
      on: {
        INC: { actions: "increment" },
        DEC: { actions: "decrement" },
      },
    },
  },
});
```

2. **Initialize ignite-element**: Pass the state machine to igniteCore:

```javascript
import { igniteCore } from "ignite-element";

const igniteElement = igniteCore({
  adapter: "xstate",
  source: counterMachine,
});
```

3. **Define Components**: Create shared and isolated components with ignite-element.

#### Shared Counter

```javascript
igniteElement.shared("shared-counter", (state, send) => {
  return html`
    <div class="p-4 bg-gray-100 border rounded-md mb-2">
      <h3 class="text-lg font-bold">Shared Counter (XState)</h3>
      <p class="text-xl">Count: ${state.context.count}</p>
      <div class="mt-4 space-x-2">
        <button
          class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          @click=${() => send({ type: "DEC" })}
        >
          -
        </button>
        <button
          class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          @click=${() => send({ type: "INC" })}
        >
          +
        </button>
      </div>
    </div>
  `;
});
```

#### Isolated Counter

```javascript
igniteElement.isolated("isolated-counter", (state, send) => {
  return html`
    <div class="p-4 bg-yellow-100 border rounded-md mb-2">
      <h3 class="text-lg font-bold text-yellow-800">
        Isolated Counter (XState)
      </h3>
      <p class="text-xl text-yellow-700">Count: ${state.context.count}</p>
      <div class="mt-4 space-x-2">
        <button
          class="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          @click=${() => send({ type: "DEC" })}
        >
          -
        </button>
        <button
          class="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600"
          @click=${() => send({ type: "INC" })}
        >
          +
        </button>
      </div>
    </div>
  `;
});
```

4. **Add Components to HTML**: Use the custom elements in you HTML file:

```html
<shared-counter></shared-counter> <isolated-counter></isolated-counter>
```
