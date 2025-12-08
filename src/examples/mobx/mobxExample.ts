import { html } from "lit-html";
import { igniteCore } from "../../mobx";
import counterStore from "./mobxCounterStore";

type CounterStoreInstance = ReturnType<typeof counterStore>;

const mobxStates = (snapshot: CounterStoreInstance) => ({
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

registerIsolatedMobx(
	"another-counter-mobx",
	({ count, decrement, increment }) => {
		return html`
    <div>
      <link rel="stylesheet" href="./another-counter-mobx.css" />
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
