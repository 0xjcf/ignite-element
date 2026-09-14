import { expect, it, vi } from "vitest";
import { createActor, SimulatedClock } from "xstate";
import {
	type PreferenceReceipt,
	type PreferenceRequest,
	preferenceMachine,
} from "./shared-session";

function fixture() {
	const receipts: Array<(receipt: PreferenceReceipt) => void> = [];
	const requests: PreferenceRequest[] = [];
	const save = vi.fn((request: PreferenceRequest) => {
		requests.push(request);
		return new Promise<PreferenceReceipt>((resolve) => receipts.push(resolve));
	});
	const clock = new SimulatedClock();
	const source = createActor(preferenceMachine, {
		input: { ports: { save }, uncertaintyMs: 50 },
		clock,
	}).start();
	source.send({ type: "SIGN_IN", account: "A", initial: "comfortable" });
	return { source, clock, save, requests, receipts };
}
it("keeps a receipt invocation alive past uncertainty with the native clock", async () => {
	const { source, clock, save, requests, receipts } = fixture();
	try {
		source.send({
			type: "SAVE",
			value: "compact",
			generation: source.getSnapshot().context.generation,
		});
		expect(
			source.getSnapshot().matches({ active: { saving: "pending" } }),
		).toBe(true);
		clock.increment(50);
		expect(
			source.getSnapshot().matches({ active: { saving: "unknown" } }),
		).toBe(true);
		source.send({
			type: "SAVE",
			value: "duplicate",
			generation: source.getSnapshot().context.generation,
		});
		expect(save).toHaveBeenCalledOnce();
		receipts[0]({ ...requests[0], outcome: "confirmed" });
		await Promise.resolve();
		await Promise.resolve();
		expect(source.getSnapshot().matches({ active: "confirmed" })).toBe(true);
		expect(source.getSnapshot().context.value).toBe("compact");
	} finally {
		source.stop();
	}
});
it("resets private state and invalidates old intents and receipts with the same actor", async () => {
	const { source, save, requests, receipts } = fixture();
	try {
		const generation = source.getSnapshot().context.generation;
		source.send({ type: "SAVE", value: "old", generation });
		source.send({ type: "SIGN_OUT" });
		expect(source.getSnapshot().context).toMatchObject({
			account: null,
			value: "",
			requested: "",
		});
		source.send({ type: "SIGN_IN", account: "B", initial: "B-value" });
		source.send({ type: "SAVE", value: "stale-handler", generation });
		expect(save).toHaveBeenCalledOnce();
		receipts[0]({ ...requests[0], outcome: "confirmed" });
		await Promise.resolve();
		await Promise.resolve();
		expect(source.getSnapshot().context).toMatchObject({
			account: "B",
			value: "B-value",
		});
		source.send({ type: "SIGN_OUT" });
		source.send({ type: "SIGN_IN", account: "A", initial: "fresh-A" });
		expect(source.getSnapshot().context.generation).toBeGreaterThan(generation);
		expect(source.getSnapshot().context.value).toBe("fresh-A");
	} finally {
		source.stop();
	}
});
it("preserves the confirmed value on rejection and permits a later intent", async () => {
	const { source, requests, receipts, save } = fixture();
	try {
		const generation = source.getSnapshot().context.generation;
		source.send({ type: "SAVE", value: "compact", generation });
		receipts[0]({ ...requests[0], outcome: "rejected" });
		await Promise.resolve();
		await Promise.resolve();
		expect(source.getSnapshot().matches({ active: "rejected" })).toBe(true);
		expect(source.getSnapshot().context.value).toBe("comfortable");
		source.send({ type: "SAVE", value: "compact", generation });
		expect(save).toHaveBeenCalledTimes(2);
	} finally {
		source.stop();
	}
});
it("does not accept a receipt from another account or generation", async () => {
	const { source, requests, receipts } = fixture();
	try {
		source.send({
			type: "SAVE",
			value: "compact",
			generation: source.getSnapshot().context.generation,
		});
		receipts[0]({ ...requests[0], account: "unrelated", outcome: "confirmed" });
		await Promise.resolve();
		await Promise.resolve();
		expect(
			source.getSnapshot().matches({ active: { saving: "unknown" } }),
		).toBe(true);
		expect(source.getSnapshot().context.value).toBe("comfortable");
	} finally {
		source.stop();
	}
});
it("does not report transport failure as a confirmed rejection", async () => {
	const source = createActor(preferenceMachine, {
		input: {
			uncertaintyMs: 50,
			ports: {
				save: async () => {
					throw Error("offline");
				},
			},
		},
	}).start();
	try {
		source.send({ type: "SIGN_IN", account: "A", initial: "comfortable" });
		source.send({
			type: "SAVE",
			value: "compact",
			generation: source.getSnapshot().context.generation,
		});
		await Promise.resolve();
		await Promise.resolve();
		expect(
			source.getSnapshot().matches({ active: { saving: "unknown" } }),
		).toBe(true);
	} finally {
		source.stop();
	}
});
