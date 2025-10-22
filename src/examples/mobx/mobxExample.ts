import { html } from "lit-html";
import { setGlobalStyles } from "../../globalStyles";
import { igniteCore } from "../../IgniteCore";
import counterStore from "./mobxCounterStore";

// Set global styles for shared theme
const themeHref = new URL("./theme.css", import.meta.url).href;
setGlobalStyles(themeHref);

type CounterStoreInstance = ReturnType<typeof counterStore>;

const mobxStates = (snapshot: CounterStoreInstance) => ({
	count: snapshot.count,
});

const mobxCommands = (store: CounterStoreInstance) => ({
	decrement: () => store.decrement(),
	increment: () => store.increment(),
});

// Initialize igniteCore with MobX adapter
const sharedStore = counterStore();

export const registerSharedMobx = igniteCore({
	source: sharedStore,
	states: mobxStates,
	commands: mobxCommands,
});

export const registerIsolatedMobx = igniteCore({
	source: counterStore,
	states: mobxStates,
	commands: mobxCommands,
});

// Shared Counter Component
registerSharedMobx("my-counter-mobx", ({ count, decrement, increment }) => {
	return html`
    <div>
      <div class="container">
        <h3>Shared Counter (MobX)</h3>
        <p>Count: ${count}</p>
        <div class="button-group">
          <button @click=${() => decrement()}>-</button>
          <button @click=${() => increment()}>+</button>
        </div>
      </div>
    </div>
  `;
});

// Shared Display Component
registerSharedMobx("shared-display-mobx", ({ count }) => {
	return html`
    <div class="display">
      <h3>Shared State Display (MobX)</h3>
      <p>Shared Count: ${count}</p>
    </div>
  `;
});

// Isolated Counter Component with Custom Styles
const customStylesHref = new URL("./another-counter-mobx.css", import.meta.url)
	.href;

registerIsolatedMobx(
	"another-counter-mobx",
	({ count, decrement, increment }) => {
		return html`
    <div>
      <link rel="stylesheet" href=${customStylesHref} />
      <div class="container">
        <h3>Isolated Counter (Custom Styled)</h3>
        <p>Count: ${count}</p>
        <div class="button-group">
          <button @click=${() => decrement()}>-</button>
          <button @click=${() => increment()}>+</button>
        </div>
      </div>
    </div>
  `;
	},
);
