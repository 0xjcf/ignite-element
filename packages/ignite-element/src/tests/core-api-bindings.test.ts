import { describe, expect, it, vi } from "vitest";
import { assign, createActor, createMachine, fromCallback } from "xstate";
import { igniteCore as webCore } from "../actor-web/web";
import { igniteCore } from "../xstate";

const machine = createMachine({
	context: { count: 0 },
	on: {
		ADD: { actions: assign({ count: ({ context }) => context.count + 1 }) },
	},
});
const makeCore = () =>
	igniteCore({
		source: machine,
		states: (snapshot) => ({ count: snapshot.context.count }),
		commands: ({ actor }) => ({ add: () => actor.send({ type: "ADD" }) }),
	});

describe("owning core keyed API", () => {
	it("drains a private actor once, and never starts an unused actor", () => {
		const start = vi.fn();
		const stop = vi.fn();
		const privateMachine = createMachine({
			invoke: {
				src: fromCallback(() => {
					start();
					return stop;
				}),
			},
		});
		const unused = igniteCore({ source: privateMachine });
		unused.get("schema");
		unused.dispose();
		expect(start).not.toHaveBeenCalled();
		const owned = igniteCore({ source: privateMachine });
		owned.get("states");
		expect(start).toHaveBeenCalledOnce();
		owned.dispose();
		owned.dispose();
		expect(stop).toHaveBeenCalledOnce();
	});
	it("keeps another core observing a borrowed shared source after disposal", async () => {
		const actor = createActor(machine).start();
		const sourceStop = vi.spyOn(actor, "stop");
		const first = igniteCore({
			source: actor,
			states: (snapshot) => ({ count: snapshot.context.count }),
		});
		const second = igniteCore({
			source: actor,
			states: (snapshot) => ({ count: snapshot.context.count }),
		});
		const firstDelivery = vi.fn(),
			secondDelivery = vi.fn();
		const oldHandle = first.watch(firstDelivery);
		second.watch(secondDelivery);
		first.dispose();
		oldHandle.unsubscribe();
		actor.send({ type: "ADD" });
		expect(firstDelivery).not.toHaveBeenCalled();
		expect(secondDelivery).toHaveBeenCalledWith({ count: 1 }, { count: 0 });
		expect(sourceStop).not.toHaveBeenCalled();
		second.dispose();
		actor.stop();
	});
	it("guards reentrant disposal during registration without poisoning a failed attempt", () => {
		const core = makeCore();
		const reason = { registration: "failed" };
		const define = vi.spyOn(customElements, "define").mockImplementation(() => {
			expect(() => core.dispose()).toThrow(/register/i);
			throw reason;
		});
		try {
			try {
				core("reentrant-core", () => null);
				throw Error("expected failure");
			} catch (error) {
				expect(error).toBe(reason);
			}
		} finally {
			define.mockRestore();
		}
		expect(() => core.dispose()).not.toThrow();
	});
	it("keeps metadata reads pure and immutable across preparation and disposal", () => {
		const commands = vi.fn(() => ({ add: () => 1 }));
		const core = igniteCore({ source: machine, commands });
		const before = core.get("schema");
		expect(before).toEqual({
			schemaVersion: 1,
			states: { schema: null },
			commands: null,
			events: [],
		});
		expect(commands).not.toHaveBeenCalled();
		core.get("states");
		expect(core.get("commands")).toEqual({ add: { input: null } });
		expect(before.commands).toBeNull();
		core.dispose();
		expect(core.get("commands")).toEqual({ add: { input: null } });
		expect(() => core.get("states")).toThrow(/disposed/i);
		expect(() => core.watch(() => {})).toThrow(/disposed/i);
		core.dispose();
	});
	it("watches next and previous states without initial user delivery", async () => {
		const core = makeCore();
		const handler = vi.fn();
		const handle = core.watch(handler);
		expect(handler).not.toHaveBeenCalled();
		await core.execute({ command: "add" });
		expect(handler).toHaveBeenCalledWith({ count: 1 }, { count: 0 });
		handle.unsubscribe();
		handle.unsubscribe();
		core.dispose();
	});
	it("does not stop borrowed actors or create an unused private actor", () => {
		const actor = createActor(machine).start();
		const stop = vi.spyOn(actor, "stop");
		const core = igniteCore({ source: actor });
		core.get("states");
		core.dispose();
		expect(stop).not.toHaveBeenCalled();
		actor.stop();
		const commands = vi.fn(() => ({}));
		igniteCore({ source: machine, commands }).dispose();
		expect(commands).not.toHaveBeenCalled();
	});
	it("rejects state/command collisions", () => {
		// Dynamic keys are checked at runtime; exact-key rejection has a strict type test.
		const states = (): Record<string, number> => ({ same: 1 });
		const core = igniteCore({
			source: machine,
			states,
			commands: () => ({ same: () => 2 }),
		});
		expect(() => core.get("states")).toThrow(/collision/i);
		core.dispose();
	});
	it("rejects owning disposal after registration, but not failed registration", () => {
		const core = makeCore();
		expect(() => core("notvalid", () => null)).toThrow();
		core.dispose();
		const registered = makeCore();
		registered("core-bindings-registered", () => null);
		expect(() => registered.dispose()).toThrow(/register/i);
	});
	it("web factories cannot be acquired headlessly", async () => {
		const source = vi.fn(() => ({
			address: "test",
			snapshot: () => ({
				address: "test",
				context: {},
				phase: "ready",
				toJSON: () => ({}),
			}),
			subscribe: () => () => {},
		}));
		const core = webCore({
			source,
			commands: () => ({ run() {} }),
			events: (event) => ({ changed: event() }),
		});
		expect(core.get("commands")).toBeNull();
		expect(() => core.get("states")).toThrow(/element/i);
		expect(() => core.watch(() => {})).toThrow(/element/i);
		expect(() => core.on("changed", () => {})).toThrow(/element/i);
		await expect(core.execute({ command: "run" })).rejects.toThrow(/element/i);
		expect(source).not.toHaveBeenCalled();
		core.dispose();
	});
});
