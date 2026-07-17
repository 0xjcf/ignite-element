import { afterEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "xstate";
import type { VoiceWorkbenchPorts } from "./ports";
import {
	createVoiceWorkbenchSessionActor,
	type VoiceWorkbenchSessionActor,
} from "./session";
import {
	createVoiceWorkbenchRuntime,
	type CreateVoiceWorkbenchRuntimeOptions,
	type VoiceWorkbenchRuntime,
} from "./workbench-runtime";

const active: Array<{
	actor: VoiceWorkbenchSessionActor;
	runtime: VoiceWorkbenchRuntime;
}> = [];

afterEach(() => {
	for (const entry of active.splice(0)) {
		entry.runtime.dispose();
		entry.actor.stop();
	}
});

const createRuntime = (
	ports: VoiceWorkbenchPorts,
	options: Pick<CreateVoiceWorkbenchRuntimeOptions, "modelTurnTimeoutMs"> = {},
) => {
	const actor = createVoiceWorkbenchSessionActor().start();
	const runtime = createVoiceWorkbenchRuntime({ actor, ports, ...options });
	active.push({ actor, runtime });
	return { actor, runtime };
};

const deferred = <Value>() => {
	let resolve!: (value: Value) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
};

const inertPorts = {
	voiceCapture: () => undefined,
	speechDelivery: () => undefined,
} satisfies Pick<VoiceWorkbenchPorts, "voiceCapture" | "speechDelivery">;

describe("voice workbench host runtime", () => {
	it("deduplicates model preparation and aborts outstanding host work on disposal", async () => {
		const pending = deferred<
			Awaited<ReturnType<VoiceWorkbenchPorts["modelPreparation"]>>
		>();
		let preparationSignal: AbortSignal | undefined;
		const modelPreparation = vi.fn<VoiceWorkbenchPorts["modelPreparation"]>(
			(_request, { signal }) => {
				preparationSignal = signal;
				return pending.promise;
			},
		);
		const { actor, runtime } = createRuntime({
			modelPreparation,
			modelTurn: () => new Promise(() => {}),
			...inertPorts,
		});

		runtime.drive();
		runtime.drive(actor.getSnapshot());
		expect(modelPreparation).toHaveBeenCalledOnce();
		runtime.dispose();
		expect(preparationSignal?.aborted).toBe(true);

		pending.resolve({ type: "available", sequence: 1 });
		await pending.promise;
		await Promise.resolve();
		expect(actor.getSnapshot().value).toBe("preparing");
	});

	it("turns a rejected model port promise into one correlated child failure", async () => {
		const modelTurn = vi.fn<VoiceWorkbenchPorts["modelTurn"]>(
			async (request) => {
				if (request.type === "request-model") {
					return {
						receipt: {
							type: "MODEL_RESOLVED",
							turnId: request.turnId,
							attemptId: request.attemptId,
							result: {
								ok: true,
								calls: [
									{
										id: "complete",
										command: "completeResponse",
										input: { text: "Never committed" },
									},
								],
							},
						},
					};
				}
				throw new Error("Port rejected.");
			},
		);
		const { actor } = createRuntime({
			modelPreparation: async (request) => ({
				type: "available",
				sequence: request.sequence,
			}),
			modelTurn,
			...inertPorts,
		});
		await waitFor(actor, (snapshot) => snapshot.matches("available"));
		actor.send({
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: "Exercise rejection fencing" },
		});

		const completed = await waitFor(
			actor,
			(snapshot) =>
				snapshot.matches({ available: { turn: "idle" } }) &&
				snapshot.context.lastTurnTerminal !== null,
		);

		expect(modelTurn).toHaveBeenCalledTimes(2);
		expect(completed.context.lastTurnTerminal).toMatchObject({
			type: "TURN_FAILED",
		});
		expect(completed.context.lastModelTurnResult).toMatchObject({
			accepted: false,
			reason: "model-failed",
		});
	});

	it("owns the model timeout and emits one correlated timeout intent", async () => {
		let timeoutCallback: (() => void) | undefined;
		let modelSignal: AbortSignal | undefined;
		const disposeTimeout = vi.fn();
		const modelTurn = vi.fn<VoiceWorkbenchPorts["modelTurn"]>(
			(_request, { signal }) => {
				modelSignal = signal;
				return new Promise(() => {});
			},
		);
		const { actor, runtime } = createRuntime(
			{
				modelPreparation: async (request) => ({
					type: "available",
					sequence: request.sequence,
				}),
				modelTurn,
				...inertPorts,
				clock: {
					setTimeout(callback, delayMs) {
						expect(delayMs).toBe(25);
						timeoutCallback = callback;
						return { dispose: disposeTimeout };
					},
				},
			},
			{ modelTurnTimeoutMs: 25 },
		);
		await waitFor(actor, (snapshot) => snapshot.matches("available"));
		actor.send({
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: "Time out this turn" },
		});
		await vi.waitFor(() => expect(modelTurn).toHaveBeenCalledOnce());
		runtime.drive();
		runtime.drive(actor.getSnapshot());
		expect(modelTurn).toHaveBeenCalledOnce();
		expect(timeoutCallback).toBeTypeOf("function");

		timeoutCallback?.();
		const timedOut = await waitFor(
			actor,
			(snapshot) => snapshot.context.lastTurnTerminal?.type === "TIMEOUT",
		);

		expect(timedOut.matches({ available: { turn: "idle" } })).toBe(true);
		expect(timedOut.context.childLifecycles.modelTurn).toMatchObject({
			state: "timed-out",
			terminal: { type: "TIMEOUT" },
		});
		expect(modelSignal?.aborted).toBe(true);
		expect(disposeTimeout).toHaveBeenCalledOnce();
	});

	it("rejects a late model receipt after cancellation and a newer turn starts", async () => {
		const pending: Array<ReturnType<typeof deferred<
			Awaited<ReturnType<VoiceWorkbenchPorts["modelTurn"]>>
		>>> = [];
		const modelTurn = vi.fn<VoiceWorkbenchPorts["modelTurn"]>((request) => {
			if (request.type !== "request-model") {
				throw new Error("Only model requests are expected in this test.");
			}
			const requestDeferred = deferred<
				Awaited<ReturnType<VoiceWorkbenchPorts["modelTurn"]>>
			>();
			pending.push(requestDeferred);
			return requestDeferred.promise;
		});
		const { actor } = createRuntime({
			modelPreparation: async (request) => ({
				type: "available",
				sequence: request.sequence,
			}),
			modelTurn,
			...inertPorts,
		});
		await waitFor(actor, (snapshot) => snapshot.matches("available"));
		actor.send({
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: "First turn" },
		});
		await vi.waitFor(() => expect(modelTurn).toHaveBeenCalledTimes(1));
		const firstRequest = actor.getSnapshot().context.portRequests.modelTurn;
		if (!firstRequest) throw new Error("Expected the first model request.");
		actor.send({
			type: "MODEL_TURN_CANCEL_REQUESTED",
			turnId: firstRequest.turnId,
			attemptId: firstRequest.attemptId,
		});
		expect(actor.getSnapshot().context.lastTurnTerminal?.type).toBe("CANCELLED");

		actor.send({
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: "Second turn" },
		});
		await vi.waitFor(() => expect(modelTurn).toHaveBeenCalledTimes(2));
		const secondRequest = actor.getSnapshot().context.portRequests.modelTurn;
		if (!secondRequest) throw new Error("Expected the second model request.");

		pending[0]?.resolve({
			receipt: {
				type: "MODEL_RESOLVED",
				turnId: firstRequest.turnId,
				attemptId: firstRequest.attemptId,
				result: { ok: true, calls: [] },
			},
		});
		await Promise.resolve();
		await Promise.resolve();

		expect(actor.getSnapshot().context.activeTurnId).toBe(secondRequest.turnId);
		expect(actor.getSnapshot().context.portRequests.modelTurn).toEqual(
			secondRequest,
		);
		expect(actor.getSnapshot().matches({ available: { turn: "responding" } })).toBe(
			true,
		);
	});

	it("disposes voice and replaced speech effects at the host boundary", async () => {
		const voiceDispose = vi.fn();
		const speechDisposals: ReturnType<typeof vi.fn>[] = [];
		let actor!: VoiceWorkbenchSessionActor;
		const modelTurn = vi.fn<VoiceWorkbenchPorts["modelTurn"]>(
			async (request) => {
				switch (request.type) {
					case "request-model":
						return {
							receipt: {
								type: "MODEL_RESOLVED",
								turnId: request.turnId,
								attemptId: request.attemptId,
								result: {
									ok: true,
									calls: [
										{
											id: "complete",
											command: "completeResponse",
											input: { text: "Done", speech: "Done aloud" },
										},
									],
								},
							},
						};
					case "authorize-call":
						return {
							receipt: {
								type: "AUTHORIZATION_RESOLVED",
								turnId: request.turnId,
								attemptId: request.attemptId,
								allowed: true,
							},
						};
					case "execute-call":
						actor.send({
							type: "COMPLETE_RESPONSE",
							input: { text: "Done", speech: "Done aloud" },
						});
						return {
							receipt: {
								type: "CAPABILITY_RESOLVED",
								turnId: request.turnId,
								attemptId: request.attemptId,
								feedback: {
									id: request.call.id ?? "complete",
									command: request.call.command,
									status: "accepted",
									ownerId: "workbench-component",
									view: {},
									events: [],
								},
							},
						};
				}
			},
		);
		const created = createRuntime({
			modelPreparation: async (request) => ({
				type: "available",
				sequence: request.sequence,
			}),
			modelTurn,
			voiceCapture: () => ({ dispose: voiceDispose }),
			speechDelivery: () => {
				const dispose = vi.fn();
				speechDisposals.push(dispose);
				return { dispose };
			},
		});
		actor = created.actor;
		await waitFor(actor, (snapshot) => snapshot.matches("available"));
		actor.send({ type: "VOICE_CAPTURE_START_REQUESTED" });
		actor.send({
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: "Speak this response" },
		});
		await waitFor(actor, (snapshot) =>
			snapshot.matches({ available: { speech: "delivering" } }),
		);
		expect(speechDisposals).toHaveLength(1);

		actor.send({ type: "SPEECH_DELIVERY_REPLAY_REQUESTED" });
		await vi.waitFor(() => expect(speechDisposals).toHaveLength(2));
		expect(speechDisposals[0]).toHaveBeenCalledOnce();
		created.runtime.dispose();
		expect(voiceDispose).toHaveBeenCalledOnce();
		expect(speechDisposals[1]).toHaveBeenCalledOnce();
	});
});
