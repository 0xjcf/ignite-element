import { configureStore, createSlice } from "@reduxjs/toolkit";
import { jsx } from "ignite-element/jsx/jsx-runtime";
import { igniteCore as mobxCore } from "ignite-element/mobx";
import { igniteCore as reduxCore } from "ignite-element/redux";
import { makeAutoObservable, onBecomeObserved, onBecomeUnobserved } from "mobx";

// Shared by unit and real-browser coverage; all acquisition uses public imports.
export async function exerciseFactoryLifetime(
	kind: "mobx" | "redux",
	shared: boolean,
) {
	const acquired: Array<{
		active: number;
		increment(): void;
		count(): number;
	}> = [];
	const mobxFactory = () => {
		const store = makeAutoObservable({
			count: 0,
			increment() {
				this.count++;
			},
		});
		const record = {
			active: 0,
			increment: () => store.increment(),
			count: () => store.count,
		};
		onBecomeObserved(store, "count", () => record.active++);
		onBecomeUnobserved(store, "count", () => record.active--);
		acquired.push(record);
		return store;
	};
	const slice = createSlice({
		name: "counter",
		initialState: { count: 0 },
		reducers: {
			increment: (state) => {
				state.count++;
			},
		},
	});
	const reduxFactory = () => {
		const store = configureStore({ reducer: slice.reducer });
		const record = {
			active: 0,
			increment: () => {
				store.dispatch(slice.actions.increment());
			},
			count: () => store.getState().count,
		};
		acquired.push(record);
		return {
			...store,
			subscribe(listener: () => void) {
				record.active++;
				const off = store.subscribe(listener);
				return () => {
					record.active--;
					off();
				};
			},
		};
	};
	const core =
		kind === "mobx"
			? mobxCore({
					source: shared ? mobxFactory() : mobxFactory,
					states: (s) => ({ count: s.count }),
					commands: ({ source }) => ({ increment: () => source.increment() }),
				})
			: shared
				? reduxCore({
						source: reduxFactory(),
						states: (s) => ({ count: s.count }),
						commands: ({ source: store }) => ({
							increment: () => {
								store.dispatch(slice.actions.increment());
							},
						}),
					})
				: reduxCore({
						source: reduxFactory,
						states: (s) => ({ count: s.count }),
						commands: ({ source: store }) => ({
							increment: () => {
								store.dispatch(slice.actions.increment());
							},
						}),
					});
	const beforeRegistration = acquired.length;
	const handle = core(`factory-${kind}-${crypto.randomUUID()}`, (ctx) =>
		jsx("button", { children: ctx.count, onClick: ctx.increment }),
	);
	const first = document.createElement(handle.tagName);
	const second = document.createElement(handle.tagName);
	const beforeConnection = acquired.length;
	const counts = () =>
		[first, second].map((host) => host.shadowRoot?.textContent);
	try {
		document.body.append(first, second);
		const connected = acquired.map((record) => record.active > 0);
		first.shadowRoot?.querySelector("button")?.click();
		const afterCommand = counts();
		first.remove();
		document.body.append(first); // Same-turn move must retain its acquisition.
		const afterMove = { calls: acquired.length, counts: counts() };
		first.remove();
		await Promise.resolve(); // Existing deferred disconnect contract.
		const detachedObservers = acquired.map((record) => record.active);
		document.body.append(first);
		const afterReconnect = { calls: acquired.length, counts: counts() };
		const held: unknown = Reflect.get(first, "increment");
		core.dispose();
		core.dispose();
		const released = acquired.every((record) => record.active === 0);
		const cleared = counts().every((count) => count === "");
		let staleRejected = false;
		try {
			if (typeof held === "function") held();
		} catch (error) {
			staleRejected = error instanceof Error && /disposed/.test(error.message);
		}
		first.remove();
		document.body.append(first);
		const afterDisposedConnection = {
			calls: acquired.length,
			counts: counts(),
		};
		const beforeNative = acquired[0].count();
		acquired[0].increment();
		return {
			beforeRegistration,
			beforeConnection,
			connected,
			afterCommand,
			afterMove,
			detachedObservers,
			afterReconnect,
			released,
			cleared,
			staleRejected,
			afterDisposedConnection,
			nativeStillUsable: acquired[0].count() === beforeNative + 1,
		};
	} finally {
		first.remove();
		second.remove();
		core.dispose();
	}
}
