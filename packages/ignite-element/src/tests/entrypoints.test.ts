import { configureStore } from "@reduxjs/toolkit";
import { makeAutoObservable } from "mobx";
import { describe, expect, it } from "vitest";
import { createMachine } from "xstate";
import { igniteCore as igniteCoreMobx } from "../mobx";
import { igniteCore as igniteCoreRedux } from "../redux";
import { igniteCore as igniteCoreXState, matchState } from "../xstate";

describe("public adapter entrypoints", () => {
	it("keeps the xstate entrypoint stable", () => {
		const machine = createMachine({
			initial: "idle",
			states: {
				idle: {},
			},
		});
		const component = igniteCoreXState({ source: machine });

		expect(typeof igniteCoreXState).toBe("function");
		expect(typeof matchState).toBe("function");
		expect(typeof component).toBe("function");
		expect(typeof component.execute).toBe("function");
		expect(typeof component.getState).toBe("function");
		expect(typeof component.getView).toBe("function");
		expect(typeof component.getSchema).toBe("function");
		expect(typeof component.watch).toBe("function");
		expect(typeof component.watchView).toBe("function");
		expect(typeof component.on).toBe("function");
	});

	it("keeps the redux entrypoint stable", () => {
		const store = configureStore({
			reducer: (state = { count: 0 }) => state,
		});
		const component = igniteCoreRedux({ source: store });

		expect(typeof igniteCoreRedux).toBe("function");
		expect(typeof component).toBe("function");
		expect(typeof component.execute).toBe("function");
		expect(typeof component.getState).toBe("function");
		expect(typeof component.getView).toBe("function");
		expect(typeof component.getSchema).toBe("function");
		expect(typeof component.watch).toBe("function");
		expect(typeof component.watchView).toBe("function");
		expect(typeof component.on).toBe("function");
	});

	it("keeps the mobx entrypoint stable", () => {
		const store = makeAutoObservable({
			count: 0,
		});
		const component = igniteCoreMobx({ source: store });

		expect(typeof igniteCoreMobx).toBe("function");
		expect(typeof component).toBe("function");
		expect(typeof component.execute).toBe("function");
		expect(typeof component.getState).toBe("function");
		expect(typeof component.getView).toBe("function");
		expect(typeof component.getSchema).toBe("function");
		expect(typeof component.watch).toBe("function");
		expect(typeof component.watchView).toBe("function");
		expect(typeof component.on).toBe("function");
	});
});
