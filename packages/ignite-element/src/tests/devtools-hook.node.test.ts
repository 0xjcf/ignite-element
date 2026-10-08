// @vitest-environment node

import {
	type DevtoolsEventRecord,
	installDevtoolsHook,
} from "ignite-element/devtools-hook";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assign, emit, setup } from "xstate";
import { devtoolsDelivery } from "../runtime/devtoolsHook";
import { igniteCore } from "../xstate";

afterEach(() => {
	devtoolsDelivery.hook = undefined;
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
});

function createCore() {
	const machine = setup({
		types: {
			context: {} as { count: number },
			events: {} as { type: "INC" } | { type: "RESET" },
			emitted: {} as { type: "counterReset"; count: number },
		},
	}).createMachine({
		context: { count: 0 },
		initial: "active",
		states: {
			active: {
				on: {
					INC: {
						actions: assign({
							count: ({ context }) => context.count + 1,
						}),
					},
					RESET: {
						actions: [
							assign({ count: 0 }),
							emit({ type: "counterReset", count: 0 }),
						],
					},
				},
			},
		},
	});
	return igniteCore({
		source: machine,
		states: (snapshot) => ({ count: snapshot.context.count }),
		commands: ({ source }) => ({
			increment: () => source.send({ type: "INC" }),
			reset: () => source.send({ type: "RESET" }),
		}),
		events: (event) => ({
			countChanged: event<{ count: number }>(),
			counterReset: event<{ count: number }>(),
		}),
		effects: ({ emit: emitEffect, select }) => {
			const count = select((state) => state.context.count);
			if (count.changed) {
				emitEffect({ type: "countChanged", count: count.current });
			}
		},
	});
}

describe("installDevtoolsHook", () => {
	it("receives native and effect events with their origin", async () => {
		const records: DevtoolsEventRecord[] = [];
		const uninstall = installDevtoolsHook({
			event: (record) => {
				records.push(record);
			},
		});
		const core = createCore();
		core.on("counterReset", () => {});
		const started = Date.now();
		await core.execute({ command: "increment" });
		await core.execute({ command: "reset" });
		const finished = Date.now();

		const effect = records.find((record) => record.type === "countChanged");
		const native = records.find((record) => record.type === "counterReset");
		expect(effect).toMatchObject({
			origin: "effect",
			payload: { count: 1 },
		});
		expect(native).toMatchObject({
			origin: "native",
			payload: { count: 0 },
		});
		expect(effect?.coreId).toBe(native?.coreId);
		expect(effect?.coreId).toMatch(/^devtools-core-\d+$/);
		expect(effect?.at).toBeGreaterThanOrEqual(started);
		expect(native?.at).toBeLessThanOrEqual(finished);
		expect(effect?.at).toBeTypeOf("number");

		const delivered = records.length;
		uninstall();
		await core.execute({ command: "increment" });
		expect(records).toHaveLength(delivered);
		core.dispose();
	});

	it("does not call or allocate the publisher when no hook is installed", async () => {
		const publish = vi.spyOn(devtoolsDelivery, "publish");
		const core = createCore();
		core.on("counterReset", () => {});
		await core.execute({ command: "increment" });
		await core.execute({ command: "reset" });
		expect(publish).not.toHaveBeenCalled();
		expect(devtoolsDelivery.hook).toBeUndefined();
		core.dispose();
	});

	it("is a no-op in production", async () => {
		vi.stubEnv("NODE_ENV", "production");
		const publish = vi.spyOn(devtoolsDelivery, "publish");
		const hook = vi.fn();
		const uninstall = installDevtoolsHook({ event: hook });
		const core = createCore();
		core.on("counterReset", () => {});
		await core.execute({ command: "increment" });
		await core.execute({ command: "reset" });
		expect(hook).not.toHaveBeenCalled();
		expect(publish).not.toHaveBeenCalled();
		expect(devtoolsDelivery.hook).toBeUndefined();
		uninstall();
		core.dispose();
	});

	it("does not let a throwing hook interrupt delivery", async () => {
		installDevtoolsHook({
			event: () => {
				throw new Error("devtools failed");
			},
		});
		const core = createCore();
		const seen: unknown[] = [];
		core.on("countChanged", (event) => {
			seen.push(event);
		});
		await expect(
			core.execute({ command: "increment" }),
		).resolves.toBeUndefined();
		expect(seen).toEqual([{ type: "countChanged", count: 1 }]);
		core.dispose();
	});
});
