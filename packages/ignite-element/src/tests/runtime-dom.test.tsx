/** @jsxImportSource ignite-element/jsx */
import { within } from "@testing-library/dom";
import { igniteCore } from "ignite-element/redux";
import { expect, it } from "vitest";
import counterStore, { counterSlice } from "./fixtures/reduxCounterStore";

it("real registered controls retain accessible names, interaction and observation cleanup", async () => {
	const store = counterStore();
	const core = igniteCore({
		source: store,
		states: (snapshot) => ({ count: snapshot.counter.count }),
		commands: ({ actor }) => ({
			increment: (amount: number) =>
				actor.dispatch(counterSlice.actions.addByAmount(amount)),
		}),
	});
	const name = `runtime-controls-${crypto.randomUUID()}`;
	core(name, ({ count, increment }) => (
		<section>
			<output aria-label="Counter status">{count}</output>
			<button type="button" onClick={() => increment(1)}>
				Increment
			</button>
			<label>
				Limit
				<input type="range" min="0" max="12" value={String(count)} />
			</label>
		</section>
	));
	const host = document.createElement(name);
	document.body.appendChild(host);
	try {
		const container = host.shadowRoot?.querySelector("section");
		if (!container) throw new Error("Registered component did not render");
		const controls = within(container);
		await core.execute({ command: "increment", input: 3 });
		expect(
			controls.getByRole("status", { name: "Counter status" }).textContent,
		).toBe("3");
		expect(controls.getByRole("slider", { name: "Limit" })).toHaveProperty(
			"value",
			"3",
		);
		controls.getByRole("button", { name: "Increment" }).click();
		expect(
			controls.getByRole("status", { name: "Counter status" }).textContent,
		).toBe("4");
		host.remove();
		await new Promise<void>((resolve) => queueMicrotask(resolve));
		store.dispatch(counterSlice.actions.increment());
		expect(core.get("states").count).toBe(5);
		expect(
			controls.getByRole("status", { name: "Counter status" }).textContent,
		).toBe("4");
		document.body.appendChild(host);
		expect(
			controls.getByRole("status", { name: "Counter status" }).textContent,
		).toBe("5");
	} finally {
		host.remove();
		await new Promise<void>((resolve) => queueMicrotask(resolve));
	}
	// Disconnecting Ignite observation never shuts down the caller's Redux store.
	store.dispatch(counterSlice.actions.increment());
	expect(store.getState().counter.count).toBe(6);
	expect(host.isConnected).toBe(false);
});
