# MobX Example with ignite-element

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

---

## Styling with Custom CSS

This example uses **CSS variables** for styling and customization. Global styles are applied using the `setGlobalStyles` function, referencing `theme.css`, while component-specific styles are applied using `<style>` or `<link>` tags in the components.

---

## ignite-element and MobX

### 1. Define a MobX Store

Create a reactive MobX store with decorators for state and actions:

```typescript
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

---

### 2. Apply Global Styles

Add global styles from `theme.css` using `setGlobalStyles`:

```typescript
import { setGlobalStyles } from "ignite-element";

setGlobalStyles("./theme.css");
```

---

### 3. Initialize ignite-element

Initialize `igniteCore` with shared and isolated component support:

```typescript
import { igniteCore } from "ignite-element";
import counterStore from "./mobxCounterStore";

export const { isolated, shared } = igniteCore({
  adapter: "mobx",
  source: counterStore,
});
```

---

### 4. Define Components

#### Shared Counter

```typescript
shared("my-counter-mobx", (state, action) => {
  return html`
    <div>
      <div class="container">
        <h3>Shared Counter (MobX)</h3>
        <p>Count: ${state.count}</p>
        <div class="button-group">
          <button @click=${() => action({ type: "decrement" })}>-</button>
          <button @click=${() => action({ type: "increment" })}>+</button>
        </div>
      </div>
    </div>
  `;
});
```

#### Shared Display

```typescript
shared("shared-display-mobx", (state) => {
  return html`
    <div class="display">
      <h3>Shared State Display (MobX)</h3>
      <p>Shared Count: ${state.count}</p>
    </div>
  `;
});
```

#### Isolated Counter

```typescript
isolated("another-counter-mobx", (state, action) => {
  return html`
    <div>
      <link rel="stylesheet" href="./another-counter-mobx.css" />
      <div class="container">
        <h3>Isolated Counter (Custom Styled)</h3>
        <p>Count: ${state.count}</p>
        <div class="button-group">
          <button @click=${() => action({ type: "decrement" })}>-</button>
          <button @click=${() => action({ type: "increment" })}>+</button>
        </div>
      </div>
    </div>
  `;
});
```

---

### 5. Add Components to HTML

Use the custom elements in your HTML file:

```html
<my-counter-mobx></my-counter-mobx>
<shared-display-mobx></shared-display-mobx>
<another-counter-mobx></another-counter-mobx>
```
