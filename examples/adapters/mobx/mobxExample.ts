import { html } from "lit-html";
import "@ignite-element/renderer/lit";
import { igniteCore } from "ignite-element/mobx";
import anotherCounterStyles from "./another-counter-mobx.css?raw";
import counterStore from "./mobxCounterStore";
// Ignite renders into Shadow DOM, so shared theme styles are pulled in as raw
// text and injected into each component's shadow root via a <style> tag — the
// config-free path (no ignite.config.ts, no build plugin). theme.css is written
// against `:host`, so it scopes cleanly to each element.
import themeStyles from "./theme.css?raw";

type CounterStoreInstance = ReturnType<typeof counterStore>;

const mobxStates = (snapshot: CounterStoreInstance) => ({
	count: snapshot.count,
});

const mobxCommands = ({ actor }: { actor: CounterStoreInstance }) => ({
	decrement: () => actor.decrement(),
	increment: () => actor.increment(),
});

// Initialize igniteCore with MobX adapter
function createMemoryPersistence(initialCount = 0) {
	let current = initialCount;
	const listeners = new Set<(count: number) => void>();

	return {
		load() {
			return current;
		},
		save(count: number) {
			current = count;
			for (const listener of listeners) {
				listener(current);
			}
		},
		observe(listener: (count: number) => void) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}

const sharedStore = counterStore({
	persistence: createMemoryPersistence(),
});

export const disposeSharedMobx = () => {
	sharedStore.dispose();
};

export const registerSharedMobx = igniteCore({
	source: sharedStore,
	states: mobxStates,
	commands: mobxCommands,
});

// An isolated MobX source is a factory (`() => Counter`) so each element gets
// its own store. A bare function source is ambiguous at the type level (unlike
// xstate's machine object or redux's slice), so the factory form requires an
// explicit `adapter: "mobx"` tag — the shared form above infers it from the
// live instance.
export const registerIsolatedMobx = igniteCore({
	adapter: "mobx",
	source: counterStore,
	states: mobxStates,
	commands: mobxCommands,
});

// Shared Counter Component
registerSharedMobx("my-counter-mobx", (ctx) => {
	return html`
    <style>${themeStyles}</style>
    <div>
      <div class="container">
        <h3>Shared Counter (MobX)</h3>
        <p>Count: ${ctx.count}</p>
        <div class="button-group">
          <button @click=${() => ctx.decrement()}>-</button>
          <button @click=${() => ctx.increment()}>+</button>
        </div>
      </div>
    </div>
  `;
});

// Shared Display Component
registerSharedMobx("shared-display-mobx", (ctx) => {
	return html`
    <style>${themeStyles}</style>
    <div class="display">
      <h3>Shared State Display (MobX)</h3>
      <p>Shared Count: ${ctx.count}</p>
    </div>
  `;
});

registerIsolatedMobx("another-counter-mobx", (ctx) => {
	return html`
    <style>${themeStyles}</style>
    <div>
      <style>${anotherCounterStyles}</style>
      <div class="container">
        <h3>Isolated Counter (Custom Styled)</h3>
        <p>Count: ${ctx.count}</p>
        <div class="button-group">
          <button @click=${() => ctx.decrement()}>-</button>
          <button @click=${() => ctx.increment()}>+</button>
        </div>
      </div>
    </div>
  `;
});
