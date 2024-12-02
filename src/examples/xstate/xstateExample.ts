import { html } from "lit-html";
import counterMachine from "./xstateCounterMachine";
import { igniteCore } from "../../IgniteCore";

const igniteElement = igniteCore({
  adapter: "xstate",
  source: counterMachine,
  styles: {
    paths: ["./dist/styles.css"],
    custom: `
      .mb-2 {
        margin-bottom: 2rem
      }
    `
  },
});

// Shared Counter Component (XState)
igniteElement.shared("my-counter-xstate", (state, send) => {
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

// Shared Display Component (XState)
igniteElement.shared("shared-display-xstate", (state) => {
  return html`
    <div class="p-4 bg-blue-100 border rounded-md mb-2">
      <h3 class="text-lg font-bold text-blue-800">
        Shared State Display (XState)
      </h3>
      <p class="text-xl text-blue-700">Shared Count: ${state.context.count}</p>
    </div>
  `;
});

// Isolated Counter Component (XState)
igniteElement.isolated("another-counter-xstate", (state, send) => {
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
