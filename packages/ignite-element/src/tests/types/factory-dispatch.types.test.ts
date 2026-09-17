import { configureStore, createSlice } from "@reduxjs/toolkit";
import { igniteCore as root } from "ignite-element";
import { makeAutoObservable } from "mobx";
import { expect, it } from "vitest";
import { igniteCore as internal } from "../../IgniteCore";
import { mobxFactoryContracts } from "./factory-mobx";
import { reduxFactoryContracts } from "./factory-redux";

function contracts() {
	const mobx = () => makeAutoObservable({ count: 0 });
	const slice = createSlice({
		name: "counter",
		initialState: { count: 0 },
		reducers: {},
	});
	const redux = () => configureStore({ reducer: slice.reducer });
	// @ts-expect-error The internal dispatcher cannot identify an ambiguous factory.
	internal({ source: mobx });
	// @ts-expect-error The internal dispatcher cannot identify an ambiguous factory.
	internal({ source: redux });
	internal({ source: mobx, adapter: "mobx" });
	internal({ source: redux, adapter: "redux" });
	root();
	root(undefined);
	root({});
	// @ts-expect-error Public root is source-free, including factories.
	root({ source: mobx });
	// @ts-expect-error Explicit adapter never enables source-aware root calls.
	root({ source: mobx, adapter: "mobx" });
	// @ts-expect-error Public root is source-free, including factories.
	root({ source: redux });
	// @ts-expect-error Explicit adapter never enables source-aware root calls.
	root({ source: redux, adapter: "redux" });
}
void contracts;
void mobxFactoryContracts;
void reduxFactoryContracts;

it("keeps root validation and internal ambiguous-factory rejection without acquisition", () => {
	let calls = 0;
	const source = () => {
		calls++;
		return makeAutoObservable({ count: 0 });
	};
	for (const config of [
		{ source },
		{ source, adapter: "mobx" },
		{ source, adapter: "redux" },
	]) {
		expect(() => Reflect.apply(root, undefined, [config])).toThrow(
			/source-free/i,
		);
	}
	expect(() => Reflect.apply(internal, undefined, [{ source }])).toThrow(
		/adapter/i,
	);
	expect(calls).toBe(0);
});
