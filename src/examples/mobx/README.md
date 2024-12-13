# Mobx Example with ignite-element

This example demonstrates how to use ignite-element with MobX, lit-html, and custom CSS for styling, following atomic design principles.

---

## Features

- State management with MobX, showcasing shared and isolated components.
- Dynamic styling with CSS variables for customizable and reusable styles.
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

## Styling with Custom CSS

This example uses **CSS variables** for styling and customization. The shared styles are defined in the `igniteCore` configuration, and component-specific styles are applied using `<style>` tags in the components.

## ignite-element and Mobx

1. **Define a MobX Store**: Create a reactive MobX store with decorators for state and actions.

```javascript
import { action, observable, makeObservable } from "mobx";

class Counter {
  @observable count = 0;

  constructor() {
    makeObservable(this);
  }

  @action increment() {
    this.count += 1;
  }

  @action decrement() {
    this.count -= 1;
  }
}

const counterStore = () => new Counter();

export default counterStore;
```

2. **Initialize ignite-element**: Pass the Mobx store to igniteCore:

```javascript
import { igniteCore } from "ignite-element";

const igniteElement = igniteCore({
  adapter: "mobx",
  source: counterStore,
  styles: {
    custom: `
      :host {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        margin: 10px;
        padding: 10px;
        border: 1px solid var(--border-color, #ccc);
        border-radius: 5px;
        background-color: var(--background-color, #f9f9f9);
      }

      h3 {
        color: var(--header-color, #000);
      }

      button {
        margin: 5px;
        padding: 5px 10px;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        background-color: var(--button-color, #007bff);
        color: var(--button-text-color, white);
      }

      button:hover {
        background-color: var(--button-hover-color, #0056b3);
      }
    `,
  },
});
```

3. **Define Components**: Create shared and isolated components with ignite-element.

#### Shared Counter

```javascript
igniteElement.shared("my-counter-mobx", (state, send) => {
  return html`
    <style>
      :host {
        --background-color: #f9f9f9;
        --header-color: #007bff;
        --button-color: #ff6b6b;
        --button-hover-color: #d9534f;
      }
    </style>
    <div>
      <h3>Shared Counter (Mobx)</h3>
      <p>Count: ${state.count}</p>
      <button @click=${() => send({ type: "decrement" })}>-</button>
      <button @click=${() => send({ type: "increment" })}>+</button>
    </div>
  `;
});
```

#### Shared Display

```javascript
igniteElement.shared("shared-display-mobx", (state) => {
  return html`
    <style>
      :host {
        --background-color: #e9ecef;
        --header-color: #17a2b8;
      }
    </style>
    <div>
      <h3>Shared State Display (Mobx)</h3>
      <p>Shared Count: ${state.count}</p>
    </div>
  `;
});
```

#### Isolated Counter

```javascript
igniteElement.isolated("another-counter-mobx", (state, action) => {
  return html`
    <style>
      :host {
        --background-color: #fff3cd;
        --header-color: #856404;
        --button-color: #ffc107;
        --button-hover-color: #ffca28;
      }
    </style>
    <div>
      <h3>Isolated Counter (Mobx)</h3>
      <p>Count: ${state.count}</p>
      <button @click=${() => action({ type: "decrement" })}>-</button>
      <button @click=${() => action({ type: "increment" })}>+</button>
    </div>
  `;
});
```

#### **Add Components to HTML** Use the custom element in your HTML file.

```html
<my-counter-mobx></my-counter-mobx>
<shared-display-mobx></shared-display-mobx>
<another-counter-mobx></another-counter-mobx>
```
