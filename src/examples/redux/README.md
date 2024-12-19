# Redux Example with ignite-element

This example demonstrates how to use ignite-element with Redux, lit-html, and Bootstrap for styling.

---

## Features

- State management with Redux, showcasing shared and isolated components.
- Styling with Bootstrap and SCSS.
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

## Styling with Bootstrap and SCSS

This example uses the **minified Bootstrap CSS** for faster build times and improved performance:

```scss
@import "bootstrap/dist/css/bootstrap.min.css";
```

To apply global styles, use the `setGlobalStyles` function to reference the compiled CSS file:

```typescript
import { setGlobalStyles } from "ignite-element";

setGlobalStyles("./scss/styles.css");
```

---

## ignite-element and Redux

### Setting Up ignite-element with Redux

#### 1. Define the Redux Store

Create a Redux store and define actions and reducer:

```typescript
import { configureStore, createSlice } from "@reduxjs/toolkit";

const counterSlice = createSlice({
  name: "counter",
  initialState: { count: 0 },
  reducers: {
    increment: (state) => {
      state.count += 1;
    },
    decrement: (state) => {
      state.count -= 1;
    },
  },
});

export const { increment, decrement } = counterSlice.actions;

const store = () =>
  configureStore({
    reducer: counterSlice.reducer,
  });

export default store;
```

---

#### 2. Apply Global Styles

Add global styles for Bootstrap and SCSS using `setGlobalStyles`:

```typescript
import { setGlobalStyles } from "ignite-element";

setGlobalStyles("./scss/styles.css");
```

---

### 3. Initialize ignite-element

Initialize `igniteCore` with shared and isolated component support:

```typescript
import { igniteCore } from "ignite-element";
import store from "./reduxStore";

export const { shared, isolated } = igniteCore({
  adapter: "redux",
  source: store,
});
```

---

#### 4. Define Components

##### Shared Counter

```typescript
shared("shared-counter-redux", (state, dispatch) => {
  return html`
    <div class="card text-start shadow-sm mb-3">
      <div class="card-header bg-primary text-white">Shared Counter</div>
      <div class="card-body">
        <h5 class="card-title">Count: ${state.count}</h5>
        <div class="d-flex">
          <button
            class="btn btn-danger me-2"
            @click=${() => dispatch({ type: "counter/decrement" })}
          >
            -
          </button>
          <button
            class="btn btn-success"
            @click=${() => dispatch({ type: "counter/increment" })}
          >
            +
          </button>
        </div>
      </div>
    </div>
  `;
});
```

##### Isolated Counter

```typescript
isolated("isolated-counter-redux", (state, dispatch) => {
  return html`
    <div class="card text-start shadow-sm mb-3">
      <div class="card-header bg-warning text-dark">Isolated Counter</div>
      <div class="card-body">
        <h5 class="card-title">Count: ${state.count}</h5>
        <div class="d-flex">
          <button
            class="btn btn-secondary me-2"
            @click=${() => dispatch({ type: "counter/decrement" })}
          >
            -
          </button>
          <button
            class="btn btn-primary"
            @click=${() => dispatch({ type: "counter/increment" })}
          >
            +
          </button>
        </div>
      </div>
    </div>
  `;
});
```

---

#### 5. Add Components to HTML

Use the custom elements in your HTML file:

```html
<shared-counter-redux></shared-counter-redux>
<isolated-counter-redux></isolated-counter-redux>
```
