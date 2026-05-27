import { html } from "lit-html";
import "../../renderers/lit";
import { igniteCore } from "ignite-element/mobx";
import anotherCounterStyles from "./another-counter-mobx.css?raw";
import counterStore from "./mobxCounterStore";

type CounterStoreInstance = ReturnType<typeof counterStore>;

const mobxView = ({ snapshot }: { snapshot: CounterStoreInstance }) => ({
	count: snapshot.count,
});

const mobxCommands = ({ actor }: { actor: CounterStoreInstance }) => ({
	decrement: () => actor.decrement(),
	increment: () => actor.increment(),
});

// Initialize igniteCore with MobX adapter
const sharedStore = counterStore();

export const registerSharedMobx = igniteCore({
	source: sharedStore,
	view: mobxView,
	commands: mobxCommands,
});

export const registerIsolatedMobx = igniteCore({
	source: counterStore,
	view: mobxView,
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

registerIsolatedMobx(
	"another-counter-mobx",
	({ count, decrement, increment }) => {
		return html`
    <div>
      <style>${anotherCounterStyles}</style>
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
