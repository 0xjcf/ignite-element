import { describe, expect, it } from "vitest";
import { configureStore, createSlice } from "@reduxjs/toolkit";
import { makeAutoObservable } from "mobx";
import { createMachine, createActor } from "xstate";
import {
	isMobxObservable,
	isReduxStore,
	isXStateActor,
} from "../adapterGuards";

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
	});
	describe("isMobxObservable", () => {
		it("returns true for observable objects", () => {
			const store = makeAutoObservable({ count: 0 });
			expect(isMobxObservable(store)).toBe(true);
		});

		it("returns false for plain objects", () => {
			expect(isMobxObservable({ count: 0 })).toBe(false);
		});
	});
});
