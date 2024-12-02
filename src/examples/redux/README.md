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

## Styling with Bootstrap and SCSS

For local development, the SCSS file imports the **minified Bootstrap CSS** for faster build times:

```scss
@import "bootstrap/dist/css/bootstrap.min.css";
```

For production, you can replace this with the full SCSS version of Bootstrap to customize styles as needed.

## ignite-element and Redux

### Setting Up ignite-element with Redux

1. **Define the Redux Store**: Create a Redux store and define actions and reducer.

```javascript
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

const store = configureStore({
  reducer: counterSlice.reducer,
});

export default store;
```

2. **Initialize ignite-element**: Pass the Redux store to igniteCore:

```javascript
import { igniteCore } from "ignite-element";
import store from "./reduxStore";

const igniteElement = igniteCore({
  adapter: "redux",
  source: store,
});
```

3. **Define Components**: Create shared and isolated components with ignite-element.

#### Shared Counter

```javascript
igniteElement.shared("shared-counter-redux", (state, dispatch) => {
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

#### Isolated Counter

```javascript
igniteElement.isolated("isolated-counter-redux", (state, dispatch) => {
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

4. **Add Components to HTML**: Use the custom elements in you HTML file:

```html
<shared-counter></shared-counter> 
<isolated-counter></isolated-counter>
```
