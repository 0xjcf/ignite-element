import type { Action, Store } from "@reduxjs/toolkit";
import { makeAutoObservable } from "mobx";
import { describe, expect, it } from "vitest";
import type { AnyStateMachine } from "xstate";
import { igniteCore } from "../IgniteCore";

// Mock XState machine
const mockXStateMachine = {} as AnyStateMachine;
// Mock Redux store
const mockReduxStore = {} as () => Store<unknown, Action<string>>;
const mockReduxActions = {
	mock: () => ({ type: "mock" }),
};
// Mock Mobx store
const mockMobxStore = () =>
	makeAutoObservable({
		count: 0,
		increment() {
			this.count += 1;
		},
	});

describe("igniteCore", () => {
	it("should initialize without errors for XState adapter", () => {
		const core = igniteCore({
			adapter: "xstate",
			source: mockXStateMachine,
		});
		expect(core).toBeDefined();
	});

	it("should initialize without errors for Redux adapter", () => {
		const core = igniteCore({
			adapter: "redux",
			source: mockReduxStore,
			actions: mockReduxActions,
		});
		expect(core).toBeDefined();
	});

	it("should initialize without errors for Mobx adapter", () => {
		const core = igniteCore({
			adapter: "mobx",
			source: mockMobxStore,
		});
		expect(core).toBeDefined();
	});

	it("should throw an error for unsupported adapters", () => {
		expect(() =>
			igniteCore({
				// @ts-expect-error This error is expected because `unknownAction` is not part of the defined event types.
				adapter: "unsupported",
				source: {} as never,
			}),
		).toThrow("Unsupported adapter: unsupported");
	});
});
