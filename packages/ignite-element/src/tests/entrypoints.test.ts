import {
	createXStateAdapter,
	isXStateActor,
	isXStateMachine,
	type XStateConfig,
} from "@ignite-element/adapters";
import { configureStore } from "@reduxjs/toolkit";
import { makeAutoObservable } from "mobx";
import { describe, expect, it } from "vitest";
import { createMachine } from "xstate";
import { igniteCore as igniteCoreActorWeb } from "../actor-web";
import { igniteCore as igniteCoreMobx } from "../mobx";
import { igniteCore as igniteCoreRedux } from "../redux";
import { igniteCore as igniteCoreXState, matchState } from "../xstate";

type ActorWebCommand = { type: "CREATE"; shipmentId: string };

function createActorWebSource() {
	const context = { shipmentId: "shipment-1", status: "created" };
	const address = "actor://server/shipment";
	return {
		address,
		snapshot: () => ({
			address,
			context,
			phase: "created",
			toJSON: () => context,
		}),
		subscribe: () => () => {},
		transportStatus: () => ({
			state: "connected" as const,
			updatedAt: 1,
		}),
		subscribeTransportStatus: () => () => {},
		send: async (_message: ActorWebCommand) => {},
		ask: async <Response = unknown>() => 1 as Response,
	};
}

describe("public adapter entrypoints", () => {
	it("keeps renderer JSX package subpaths stable", async () => {
		const rendererJsx = await import("@ignite-element/renderer/jsx");
		const rendererJsxRuntime = await import(
			"@ignite-element/renderer/jsx-runtime"
		);
		const rendererJsxIndex = await import("@ignite-element/renderer/jsx/index");

		expect(typeof rendererJsx.createIgniteJsxRenderStrategy).toBe("function");
		expect(typeof rendererJsx.registerNoDiffDenylistTag).toBe("function");
		expect(typeof rendererJsx.clearNoDiffDenylistForTests).toBe("function");
		expect(rendererJsx.Fragment).toBe(rendererJsxRuntime.Fragment);
		expect(rendererJsx.Fragment).toBe(rendererJsxIndex.Fragment);
		expect(rendererJsx.jsx).toBe(rendererJsxRuntime.jsx);
		expect(rendererJsx.jsxs).toBe(rendererJsxRuntime.jsxs);
		expect(rendererJsx.jsxDEV).toBe(rendererJsxIndex.jsxDEV);
	});

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
		expect(typeof component.getSnapshot).toBe("function");
		expect(typeof component.getView).toBe("function");
		expect(typeof component.getSchema).toBe("function");
		expect(typeof component.watchSnapshot).toBe("function");
		expect(typeof component.watchView).toBe("function");
		expect(typeof component.on).toBe("function");
	});

	it("keeps xstate exports available from the adapters root entrypoint", () => {
		const machine = createMachine({
			initial: "idle",
			states: {
				idle: {},
			},
		});
		const config = { source: machine } satisfies XStateConfig<typeof machine>;

		expect(typeof createXStateAdapter).toBe("function");
		expect(typeof isXStateActor).toBe("function");
		expect(typeof isXStateMachine).toBe("function");
		expect(config.source).toBe(machine);
	});

	it("keeps the redux entrypoint stable", () => {
		const store = configureStore({
			reducer: (state = { count: 0 }) => state,
		});
		const component = igniteCoreRedux({ source: store });

		expect(typeof igniteCoreRedux).toBe("function");
		expect(typeof component).toBe("function");
		expect(typeof component.execute).toBe("function");
		expect(typeof component.getSnapshot).toBe("function");
		expect(typeof component.getView).toBe("function");
		expect(typeof component.getSchema).toBe("function");
		expect(typeof component.watchSnapshot).toBe("function");
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
		expect(typeof component.getSnapshot).toBe("function");
		expect(typeof component.getView).toBe("function");
		expect(typeof component.getSchema).toBe("function");
		expect(typeof component.watchSnapshot).toBe("function");
		expect(typeof component.watchView).toBe("function");
		expect(typeof component.on).toBe("function");
	});

	it("keeps the actor-web entrypoint stable", () => {
		const component = igniteCoreActorWeb({
			source: createActorWebSource(),
		});

		expect(typeof igniteCoreActorWeb).toBe("function");
		expect(typeof component).toBe("function");
		expect(typeof component.execute).toBe("function");
		expect(typeof component.getSnapshot).toBe("function");
		expect(typeof component.getView).toBe("function");
		expect(typeof component.getSchema).toBe("function");
		expect(typeof component.watchSnapshot).toBe("function");
		expect(typeof component.watchView).toBe("function");
		expect(typeof component.on).toBe("function");
	});
});
