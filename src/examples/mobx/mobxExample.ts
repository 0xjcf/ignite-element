import { html } from "lit-html";
import { setGlobalStyles } from "../../globalStyles";
import { igniteCore } from "../../IgniteCore";
import counterStore from "./mobxCounterStore";

// Set global styles for shared theme
const themeHref = new URL("./theme.css", import.meta.url).href;
setGlobalStyles(themeHref);

// Initialize igniteCore with MobX adapter
const sharedStore = counterStore();

export const registerSharedMobx = igniteCore({
	adapter: "mobx",
	source: () => sharedStore,
});

export const registerIsolatedMobx = igniteCore({
	adapter: "mobx",
	source: counterStore,
});

// Shared Counter Component
registerSharedMobx("my-counter-mobx", ({ state, send }) => {
	return html`
    <div>
      <div class="container">
        <h3>Shared Counter (MobX)</h3>
        <p>Count: ${state.count}</p>
        <div class="button-group">
          <button @click=${() => send({ type: "decrement" })}>-</button>
          <button @click=${() => send({ type: "increment" })}>+</button>
        </div>
      </div>
    </div>
  `;
});

// Shared Display Component
registerSharedMobx("shared-display-mobx", ({ state }) => {
	return html`
    <div class="display">
      <h3>Shared State Display (MobX)</h3>
      <p>Shared Count: ${state.count}</p>
    </div>
  `;
});

// Isolated Counter Component with Custom Styles
const customStylesHref = new URL("./another-counter-mobx.css", import.meta.url)
	.href;

registerIsolatedMobx("another-counter-mobx", ({ state, send }) => {
	return html`
    <div>
      <link rel="stylesheet" href=${customStylesHref} />
      <div class="container">
        <h3>Isolated Counter (Custom Styled)</h3>
        <p>Count: ${state.count}</p>
        <div class="button-group">
          <button @click=${() => send({ type: "decrement" })}>-</button>
          <button @click=${() => send({ type: "increment" })}>+</button>
        </div>
      </div>
    </div>
  `;
});
