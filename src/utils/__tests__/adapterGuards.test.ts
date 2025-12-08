import { configureStore, createSlice } from "@reduxjs/toolkit";
import { makeAutoObservable } from "mobx";
import { describe, expect, it } from "vitest";
import { createActor, createMachine } from "xstate";
import {
	isFunction,
	isReduxSlice,
	isReduxStore,
	isXStateActor,
	isXStateMachine,
} from "../adapterGuards";
import { isMobxObservable } from "../mobxGuards";

describe("adapterGuards", () => {
	describe("isXStateActor", () => {
		it("returns true for actor-like objects", () => {
			const machine = createMachine({ initial: "idle", states: { idle: {} } });
			const actor = createActor(machine);
			actor.start();

			expect(isXStateActor(actor)).toBe(true);

			actor.stop();
		});

		it("returns false for machines", () => {
			const machine = createMachine({ initial: "idle", states: { idle: {} } });
			expect(isXStateActor(machine)).toBe(false);
		});

		it("returns false when required methods are missing", () => {
			const partialActor = {
				send() {},
				subscribe() {},
			};

			expect(isXStateActor(partialActor)).toBe(false);
		});

		it("returns false when getSnapshot is missing", () => {
			const partialActor = {
				send() {},
				subscribe() {},
				start() {},
				stop() {},
			};

			expect(isXStateActor(partialActor)).toBe(false);
		});

		it("returns false for null values", () => {
			expect(isXStateActor(null)).toBe(false);
		});
	});

	describe("isXStateMachine", () => {
		it("returns true for machines", () => {
			const machine = createMachine({
				initial: "idle",
				states: { idle: {} },
			});
			expect(isXStateMachine(machine)).toBe(true);
		});

		it("returns false for actors", () => {
			const machine = createMachine({ initial: "idle", states: { idle: {} } });
			const actor = createActor(machine);
			actor.start();
			expect(isXStateMachine(actor)).toBe(false);
			actor.stop();
		});

		it("returns false for null", () => {
			expect(isXStateMachine(null)).toBe(false);
		});

		it("returns false for plain objects", () => {
			expect(isXStateMachine({})).toBe(false);
		});
	});
	describe("isReduxStore", () => {
		it("returns true for redux stores", () => {
			const slice = createSlice({
				name: "counter",
				initialState: { value: 0 },
				reducers: {
					increment: (state) => {
						state.value += 1;
					},
				},
			});
			const store = configureStore({ reducer: slice.reducer });
			expect(isReduxStore(store)).toBe(true);
		});

		it("returns false for slices", () => {
			const slice = createSlice({
				name: "counter",
				initialState: { value: 0 },
				reducers: {
					increment: (state) => {
						state.value += 1;
					},
				},
			});
			expect(isReduxStore(slice)).toBe(false);
		});

		it("returns false for null", () => {
			expect(isReduxStore(null)).toBe(false);
		});
	});
	describe("isMobxObservable", () => {
		it("returns true for observable objects", () => {
			const store = makeAutoObservable({ count: 0 });
			expect(isMobxObservable(store)).toBe(true);
		});

		it("returns false for plain objects", () => {
			expect(isMobxObservable({ count: 0 })).toBe(false);
		});

		it("returns false for null", () => {
			expect(isMobxObservable(null)).toBe(false);
		});

		it("detects $$observable marker", () => {
			const observableLike = { $$observable: true };
			expect(isMobxObservable(observableLike)).toBe(true);
		});

		it("detects _atom marker", () => {
			const observableLike = { _atom: {} };
			expect(isMobxObservable(observableLike)).toBe(true);
		});

		it("detects $mobx marker", () => {
			const observableLike = { $mobx: {} };
			expect(isMobxObservable(observableLike)).toBe(true);
		});
	});

	describe("isFunction", () => {
		it("returns true for functions", () => {
			expect(isFunction(() => undefined)).toBe(true);
		});

		it("returns false for non-functions", () => {
			expect(isFunction(123)).toBe(false);
		});
	});

	describe("isReduxSlice", () => {
		it("returns true for slices", () => {
			const slice = createSlice({
				name: "counter",
				initialState: { value: 0 },
				reducers: {
					increment: (state) => {
						state.value += 1;
					},
				},
			});
			expect(isReduxSlice(slice)).toBe(true);
		});

		it("returns false for stores", () => {
			const slice = createSlice({
				name: "counter",
				initialState: { value: 0 },
				reducers: {
					increment: (state) => {
						state.value += 1;
					},
				},
			});
			const store = configureStore({ reducer: slice.reducer });
			expect(isReduxSlice(store)).toBe(false);
		});

		it("returns false for null", () => {
			expect(isReduxSlice(null)).toBe(false);
		});
	});
});
