// @vitest-environment node

import { igniteCore } from "ignite-element/xstate";
import { describe, expect, it } from "vitest";
import { assign, setup } from "xstate";
import { createFakeClock } from "../ports/clock";
import { createInMemoryConnection } from "../ports/connection";
import {
	createInMemoryStorage,
	DEVTOOLS_CONNECTION_STORAGE_KEY,
} from "../ports/storage";
import {
	connectionManifestSource,
	createConnectionCore,
} from "./connection.source";

const HOST_GLOBALS = [
	"document",
	"window",
	"localStorage",
	"sessionStorage",
] as const;

function sealHostGlobals() {
	const touched: string[] = [];
	for (const name of HOST_GLOBALS) {
		expect(name in globalThis).toBe(false);
		Object.defineProperty(globalThis, name, {
			configurable: true,
			get() {
				touched.push(name);
				return undefined;
			},
		});
	}
	return {
		touched,
		restore() {
			for (const name of HOST_GLOBALS) {
				delete (globalThis as Record<string, unknown>)[name];
			}
		},
	};
}

function createFixtureCounter() {
	const machine = setup({
		types: {
			context: {} as { count: number },
			events: {} as { type: "INC" } | { type: "DEC" },
		},
	}).createMachine({
		id: "fixture-counter",
		context: { count: 0 },
		on: {
			INC: {
				actions: assign({
					count: ({ context }) => context.count + 1,
				}),
			},
			DEC: {
				guard: ({ context }) => context.count > 0,
				actions: assign({
					count: ({ context }) => context.count - 1,
				}),
			},
		},
	});

	return igniteCore({
		source: machine,
		states: (snapshot) => ({
			count: snapshot.context.count,
			canDecrement: snapshot.can({ type: "DEC" }),
		}),
		commands: ({ source }) => ({
			increment: () => {
				source.send({ type: "INC" });
			},
			decrement: () => {
				source.send({ type: "DEC" });
			},
		}),
	});
}

function expectCloneable(value: unknown) {
	expect(structuredClone(value)).toEqual(value);
}

describe("connection source boots headless", () => {
	it("boots with fake ports and delivers the first watch once", async () => {
		const host = globalThis as { document?: unknown; localStorage?: unknown };
		expect(host.document).toBeUndefined();
		expect(host.localStorage).toBeUndefined();
		const seal = sealHostGlobals();
		const counter = createFixtureCounter();
		const connection = createInMemoryConnection();
		const storage = createInMemoryStorage();
		const clock = createFakeClock(1_700_000_000_000);
		connection.attach({
			id: "counter",
			label: "fixture-counter",
			getStates: () => counter.get("states"),
		});
		const core = createConnectionCore({ connection, storage, clock });

		try {
			const connectionDeliveries: Array<{
				states: unknown;
				previous: unknown;
			}> = [];
			const connectionWatch = core.watch((states, previous) => {
				connectionDeliveries.push({ states, previous });
			});
			expect(connectionDeliveries).toHaveLength(1);
			expect(connectionDeliveries[0]?.previous).toBeUndefined();
			expect(connectionDeliveries[0]?.states).toMatchObject({
				phase: "disconnected",
				canPause: false,
				canResume: false,
				isLive: false,
				showReconnectBanner: false,
			});
			expectCloneable(connectionDeliveries[0]?.states);

			const counterDeliveries: Array<{
				states: { count: number; canDecrement: boolean };
				previous: { count: number; canDecrement: boolean } | undefined;
			}> = [];
			const counterWatch = counter.watch((states, previous) => {
				counterDeliveries.push({ states, previous });
			});
			expect(counterDeliveries).toEqual([
				{ states: { count: 0, canDecrement: false }, previous: undefined },
			]);
			expectCloneable(counterDeliveries[0]?.states);
			expect(connection.attached("counter")?.getStates()).toEqual({
				count: 0,
				canDecrement: false,
			});

			const stored = storage.get(DEVTOOLS_CONNECTION_STORAGE_KEY);
			expect(stored).toBeTypeOf("string");
			expectCloneable(JSON.parse(stored ?? ""));
			expect(JSON.parse(stored ?? "")).toMatchObject({
				phase: "disconnected",
				runtimeId: null,
			});

			await core.execute({ command: "connect", input: "counter" });
			expect(core.get("states")).toMatchObject({
				phase: "connected.live",
				runtimeId: "counter",
				error: null,
				canPause: true,
				canResume: false,
				canDisconnect: true,
				isLive: true,
				showReconnectBanner: false,
			});
			expect(connectionDeliveries.length).toBeGreaterThan(1);
			expect(connectionDeliveries[0]?.previous).toBeUndefined();
			for (const delivery of connectionDeliveries.slice(1)) {
				expect(delivery.previous).toBeDefined();
			}
			expectCloneable(core.get("states"));
			expect(connection.messages()[0]).toMatchObject({
				v: 1,
				runtimeId: "counter",
				surface: "headless",
				kind: "hello",
				payload: null,
			});
			expectCloneable(connection.messages());

			await counter.execute({ command: "increment" });
			expect(counterDeliveries).toHaveLength(2);
			expect(counterDeliveries[1]).toEqual({
				states: { count: 1, canDecrement: true },
				previous: { count: 0, canDecrement: false },
			});
			expectCloneable(counter.get("states"));

			for (const flag of connectionManifestSource.flags) {
				expect(flag.name in core.get("states")).toBe(true);
			}
			expect(connectionManifestSource.declaredStates).toContain(
				core.get("states").phase,
			);
			expect(seal.touched).toEqual([]);

			connectionWatch.unsubscribe();
			counterWatch.unsubscribe();
		} finally {
			core.dispose();
			counter.dispose();
			seal.restore();
		}
	});

	it("pauses, resumes, disconnects, and refuses an unknown runtime", async () => {
		const seal = sealHostGlobals();
		const counter = createFixtureCounter();
		const connection = createInMemoryConnection();
		const storage = createInMemoryStorage();
		const clock = createFakeClock(0);
		connection.attach({
			id: "counter",
			label: "fixture-counter",
			getStates: () => counter.get("states"),
		});
		const core = createConnectionCore({ connection, storage, clock });

		try {
			await core.execute({ command: "connect", input: "missing" });
			expect(core.get("states")).toMatchObject({
				phase: "error",
				showReconnectBanner: true,
				canConnect: true,
				isLive: false,
			});
			expectCloneable(core.get("states"));

			await core.execute({ command: "connect", input: "counter" });
			expect(core.get("states").isLive).toBe(true);
			await core.execute({ command: "pause" });
			expect(core.get("states")).toMatchObject({
				phase: "connected.paused",
				canPause: false,
				canResume: true,
				isLive: false,
			});
			await core.execute({ command: "resume" });
			expect(core.get("states").phase).toBe("connected.live");
			await core.execute({ command: "disconnect" });
			expect(core.get("states")).toMatchObject({
				phase: "disconnected",
				runtimeId: null,
				canPause: false,
			});
			expect(
				connection.messages().some((message) => message.kind === "bye"),
			).toBe(true);
			expect(seal.touched).toEqual([]);
		} finally {
			core.dispose();
			counter.dispose();
			seal.restore();
		}
	});
});
