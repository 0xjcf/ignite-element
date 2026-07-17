// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import agentLoopSource from "./agent-loop.ts?raw";
import mainSource from "./main.tsx?raw";
import modelSource from "./model.ts?raw";
import type { SpeechRecognitionLike } from "./voice";
import voiceSource from "./voice.ts?raw";
import workbenchSource from "./workbench.tsx?raw";

let completionSequence = 0;
const completion = (calls: Array<{ name: string; input: unknown }>) => {
	const responseId = completionSequence++;
	return {
		choices: [
			{
				message: {
					role: "assistant",
					tool_calls: calls.map((call, index) => ({
						id: `response-${responseId}-call-${index}`,
						type: "function",
						function: {
							name: call.name,
							arguments: JSON.stringify(call.input),
						},
					})),
				},
			},
		],
	};
};

class FakeSpeechRecognition implements SpeechRecognitionLike {
	static current: FakeSpeechRecognition | null = null;
	continuous = false;
	interimResults = false;
	lang = "";
	onend: (() => void) | null = null;
	onerror: SpeechRecognitionLike["onerror"] = null;
	onresult: SpeechRecognitionLike["onresult"] = null;
	denied = false;
	start = vi.fn(() => {
		if (this.denied) {
			throw new DOMException("denied", "NotAllowedError");
		}
	});
	stop = vi.fn();
	abort = vi.fn();

	constructor() {
		FakeSpeechRecognition.current = this;
	}

	transcribe(text: string) {
		this.onresult?.({
			results: [{ 0: { transcript: text }, isFinal: true }],
		});
	}
}

describe("voice workbench browser entry", () => {
	const speak = vi.fn();
	const cancelSpeech = vi.fn();

	beforeEach(() => {
		speak.mockReset();
		cancelSpeech.mockReset();
		completionSequence = 0;
		FakeSpeechRecognition.current = null;
		vi.stubEnv("MLX_BASE_URL", "http://127.0.0.1:8080/v1");
		vi.stubEnv("MLX_MODEL", "consumer-selected-model");
		vi.stubGlobal("SpeechRecognition", FakeSpeechRecognition);
		vi.stubGlobal(
			"SpeechSynthesisUtterance",
			class SpeechSynthesisUtterance {
				onend: ((event: Event) => void) | null = null;
				onerror: ((event: { error: string }) => void) | null = null;
				constructor(readonly text: string) {}
			},
		);
		speak.mockImplementation((utterance: SpeechSynthesisUtterance) => {
			queueMicrotask(() =>
				utterance.onend?.(new Event("end") as SpeechSynthesisEvent),
			);
		});
		Object.defineProperty(window, "speechSynthesis", {
			configurable: true,
			value: { speak, cancel: cancelSpeech },
		});
		document.body.innerHTML = `<voice-workbench></voice-workbench>`;
	});

	it("keeps Ignite JSX as the only production UI writer", () => {
		for (const source of [mainSource, workbenchSource]) {
			expect(source).not.toMatch(
				/(?:document\.)?querySelector|shadowRoot|\.textContent|\.dataset|\.classList|\.setAttribute|\.closest/,
			);
			expect(source).not.toContain("source.send");
		}

		expect(agentLoopSource).not.toMatch(/\bcomponent\s*:/);
		expect(agentLoopSource).not.toContain("runModelTurn");
		expect(agentLoopSource).not.toContain('from "./session"');
		expect(mainSource).not.toContain("console.info");
		expect(modelSource).not.toContain("createMlxWorkbenchModel");
		expect(modelSource).not.toMatch(/\bcomponent\b/);
		expect(modelSource).not.toMatch(/\bfetch\?:/);
		expect(voiceSource).not.toContain("createRecognition");
		expect(mainSource).not.toContain("BRAVE_SEARCH_API_KEY");
		expect(mainSource).toContain("__VOICE_WORKBENCH_WEB_SEARCH_AVAILABLE__");
		expect(mainSource).toContain("createWebSearchCapability()");
		expect(mainSource).toContain("createProductPriceCapability()");
		expect(mainSource).toContain("createProductPricingDomainPack({");
		expect(mainSource).toContain("createDomainRegistry(");
		expect(mainSource).toContain("requestSequence: voiceRequest.sequence");
	});

	it("creates and revises the center document through real text and speech paths", async () => {
		const speechModule = await import("./speech");
		const createSpeechDeliveryActor = speechModule.createSpeechDeliveryActor;
		const createdSpeechActors: object[] = [];
		const createdSpeechInputs: Parameters<
			typeof createSpeechDeliveryActor
		>[0][] = [];
		const stopSpeechActor = vi.fn();
		vi.spyOn(speechModule, "createSpeechDeliveryActor").mockImplementation(
			(input) => {
				const actor = createSpeechDeliveryActor(input);
				const stop = actor.stop.bind(actor);
				createdSpeechActors.push(actor);
				createdSpeechInputs.push(input);
				vi.spyOn(actor, "stop").mockImplementation(() => {
					stopSpeechActor(actor);
					return stop();
				});
				return actor;
			},
		);
		let resolveReadiness: (response: Response) => void = () => {};
		const readiness = new Promise<Response>((resolve) => {
			resolveReadiness = resolve;
		});
		let deferNextModelRequest = false;
		let resolveDeferredModelRequest: (response: Response) => void = () => {};
		const deferredModelRequest = new Promise<Response>((resolve) => {
			resolveDeferredModelRequest = resolve;
		});
		let firstRequest = true;
		const responses = [
			completion([
				{
					name: "createArtifact",
					input: {
						id: "release-plan",
						title: "Release checklist",
						nodes: [
							{
								kind: "text",
								id: "summary",
								text: "This is not yet the requested checklist.",
							},
						],
					},
				},
				{
					name: "completeResponse",
					input: {
						text: "The release checklist is ready.",
					},
				},
			]),
			completion([
				{
					name: "reviseArtifact",
					input: {
						artifactId: "release-plan",
						expectedRevision: "1",
						nodes: [
							{
								kind: "checklist",
								id: "release-items",
								items: [
									{
										id: "verify-tools",
										label: "Verify dynamic Ignite tools",
										checked: false,
									},
								],
							},
						],
					},
				},
			]),
			completion([
				{
					name: "completeResponse",
					input: {
						text: "The release checklist is ready.",
						speech: "The release checklist is ready.",
					},
				},
			]),
			completion([
				{
					name: "reviseArtifact",
					input: {
						artifactId: "release-plan",
						expectedRevision: "2",
						nodes: [
							{
								kind: "text",
								id: "summary",
								text: "Add a speech-authored rollout checkpoint.",
							},
						],
					},
				},
			]),
			completion([
				{
					name: "completeResponse",
					input: {
						text: "The speech revision is committed.",
						speech: "The speech revision is committed.",
					},
				},
			]),
			completion([
				{
					name: "reviseArtifact",
					input: {
						artifactId: "release-plan",
						expectedRevision: "3",
						nodes: [
							{
								kind: "text",
								id: "summary",
								text: "Keep the accepted revision and recover the missing response.",
							},
						],
					},
				},
			]),
			completion([
				{
					name: "completeResponse",
					input: {
						text: "The accepted revision is complete.",
						speech: "The accepted revision is complete.",
					},
				},
			]),
		];
		const fetchMock = vi.fn(
			async (_input: RequestInfo | URL, _init?: RequestInit) => {
				if (firstRequest) {
					firstRequest = false;
					return readiness;
				}
				if (deferNextModelRequest) return deferredModelRequest;
				const response = responses.shift();
				if (!response) throw new Error("unexpected model request");
				return new Response(JSON.stringify(response), { status: 200 });
			},
		);
		vi.stubGlobal("fetch", fetchMock);
		await import("./main");
		const { component, source } = await import("./session");
		const host = document.querySelector("voice-workbench");
		if (!(host instanceof HTMLElement) || !host.shadowRoot) {
			throw new Error("voice workbench did not mount");
		}
		expect(component.getView()).toMatchObject({
			status: "preparing",
			canSubmitPrompt: false,
			model: { status: "preparing", failure: null },
			artifacts: [],
			messageCount: 0,
		});
		expect(component.getSnapshot().value).toBe("preparing");
		expect(component.getView().runtimeInspector.actor).toMatchObject({
			heading: "Compound actor state",
			matchText: 'matches("preparing")',
		});
		expect(host.shadowRoot.textContent).toContain(
			"Preparing the local MLX model",
		);
		expect(
			(host.shadowRoot.querySelector("textarea") as HTMLTextAreaElement | null)
				?.disabled,
		).toBe(true);
		resolveReadiness(
			new Response(
				JSON.stringify(completion([{ name: "workbenchReady", input: {} }])),
				{ status: 200 },
			),
		);
		await vi.waitFor(() => {
			expect(component.getView()).toMatchObject({
				status: "ready",
				canSubmitPrompt: true,
				model: { status: "available", failure: null },
			});
		});
		expect(component.getSnapshot().value).toEqual({ available: "idle" });
		expect(component.getView().runtimeInspector.actor).toMatchObject({
			heading: "Compound actor state",
			matchText: 'matches({\n  available: "idle",\n})',
		});
		expect(host.shadowRoot.textContent).toContain(
			"Your first accepted artifact will appear here",
		);
		expect(host.shadowRoot.textContent).not.toContain("browser-demo");

		const prompt = host.shadowRoot.querySelector("textarea");
		const form = host.shadowRoot.querySelector("form");
		if (
			!(prompt instanceof HTMLTextAreaElement) ||
			!(form instanceof HTMLFormElement)
		) {
			throw new Error("voice workbench form is unavailable");
		}
		prompt.value = "Create a release checklist";
		prompt.dispatchEvent(new Event("input", { bubbles: true }));
		form.dispatchEvent(
			new Event("submit", { bubbles: true, cancelable: true }),
		);

		await vi.waitFor(() => {
			expect(component.getView()).toMatchObject({
				status: "ready",
				artifacts: [
					{
						id: "release-plan",
						title: "Release checklist",
						revision: "2",
					},
				],
			});
			expect(host.shadowRoot?.textContent).toContain(
				"Verify dynamic Ignite tools",
			);
			expect(component.getView()).toMatchObject({
				presentation: {
					documentCommit: {
						id: "release-plan",
						revision: "2",
						title: "Release checklist",
					},
					speechCommit: {
						text: "The release checklist is ready.",
						status: "played",
					},
				},
			});
			expect(speak).toHaveBeenCalledWith(
				expect.objectContaining({ text: "The release checklist is ready." }),
			);
		});
		await vi.waitFor(() => {
			expect(createdSpeechActors.length).toBeGreaterThan(0);
			expect(stopSpeechActor).toHaveBeenCalledTimes(createdSpeechActors.length);
		});
		const initialSpeech = component.getView().speech;
		if (!initialSpeech)
			throw new Error("initial speech request was not retained");
		expect(createdSpeechInputs).toHaveLength(1);
		expect(createdSpeechInputs[0]).toMatchObject({
			id: initialSpeech.id,
			text: initialSpeech.text,
			attemptId: `${initialSpeech.id}:1`,
			requestSequence: 1,
		});
		speak.mockImplementationOnce(() => {});
		await component.execute({ command: "playSpeech" });
		await vi.waitFor(() => expect(createdSpeechInputs).toHaveLength(2));
		await component.execute({ command: "playSpeech" });
		await vi.waitFor(() => expect(createdSpeechInputs).toHaveLength(3));
		expect(
			createdSpeechInputs.map(({ requestSequence }) => requestSequence),
		).toEqual([1, 2, 3]);
		expect(createdSpeechInputs.map(({ attemptId }) => attemptId)).toEqual([
			`${initialSpeech.id}:1`,
			`${initialSpeech.id}:2`,
			`${initialSpeech.id}:3`,
		]);
		expect(cancelSpeech).toHaveBeenCalledOnce();
		expect(
			(
				component.getSnapshot().context as unknown as {
					speechDeliveryControlSequence: number;
				}
			).speechDeliveryControlSequence,
		).toBe(3);
		expect(component.getSnapshot().context.artifactRevisions).toMatchObject([
			{ id: "release-plan", revision: "1", nodes: [{ kind: "text" }] },
			{
				id: "release-plan",
				revision: "2",
				nodes: [{ kind: "checklist" }],
			},
		]);
		expect(
			host.shadowRoot.querySelector(
				'details[data-command-name="completeResponse"]',
			)?.textContent,
		).toContain("workbench-component · live · gated");
		const terminalPreview = host.shadowRoot.querySelector(
			'button[aria-label="Terminal preview"]',
		);
		if (!(terminalPreview instanceof HTMLButtonElement)) {
			throw new Error("terminal runtime preview is unavailable");
		}
		terminalPreview.click();
		expect(terminalPreview.getAttribute("aria-pressed")).toBe("true");
		expect(
			host.shadowRoot.querySelector(".projection-preview")?.textContent,
		).toContain("Preview only · no remote terminal sync");
		const [, auditInit] = fetchMock.mock.calls[2] ?? [];
		const auditRequest = JSON.parse(String(auditInit?.body));
		expect(
			auditRequest.tools.map(
				(tool: { function: { name: string } }) => tool.function.name,
			),
		).toContain("reviseArtifact");
		expect(
			auditRequest.messages.map((message: { role: string }) => message.role),
		).toContain("tool");
		expect(
			auditRequest.messages
				.filter((message: { role: string }) => message.role === "tool")
				.map(
					(message: { content: string }) =>
						JSON.parse(message.content).snapshot.outcome,
				),
		).toEqual(["accepted", "deferred"]);

		const schemaTab = host.shadowRoot.querySelector("#schema-tab");
		if (!(schemaTab instanceof HTMLButtonElement)) {
			throw new Error("schema tab is unavailable");
		}
		schemaTab.click();
		expect(schemaTab.getAttribute("aria-selected")).toBe("true");
		expect(
			host.shadowRoot.querySelector(".schema-view")?.textContent,
		).toContain('"revision": "2"');

		const currentPrompt = host.shadowRoot.querySelector("textarea");
		if (!(currentPrompt instanceof HTMLTextAreaElement)) {
			throw new Error("voice workbench prompt is unavailable");
		}
		currentPrompt.value = "Keep this typed draft";
		currentPrompt.dispatchEvent(new Event("input", { bubbles: true }));
		const microphone = host.shadowRoot.querySelector("#mic-button");
		if (!(microphone instanceof HTMLButtonElement)) {
			throw new Error("microphone button is unavailable");
		}
		microphone.click();
		expect(FakeSpeechRecognition.current?.start).toHaveBeenCalledOnce();
		expect(
			host.shadowRoot.querySelector(".shell")?.getAttribute("data-voice-state"),
		).toBe("listening");
		FakeSpeechRecognition.current?.transcribe("Revise the plan through speech");
		const useTranscript = host.shadowRoot.querySelector("#use-transcript");
		if (!(useTranscript instanceof HTMLButtonElement)) {
			throw new Error("use transcript button is unavailable");
		}
		useTranscript.click();
		await vi.waitFor(() => {
			expect(
				component.getSnapshot().context.childLifecycles.voiceCapture,
			).toMatchObject({
				state: "consumed",
				attemptId: "voice:1",
			});
		});

		await vi.waitFor(() => {
			expect(component.getView()).toMatchObject({
				status: "ready",
				artifacts: [{ id: "release-plan", revision: "3" }],
			});
			expect(host.shadowRoot?.textContent).toContain(
				"Add a speech-authored rollout checkpoint.",
			);
			expect(component.getView()).toMatchObject({
				presentation: {
					documentCommit: { id: "release-plan", revision: "3" },
				},
			});
		});
		expect(component.getView().messages).toContainEqual({
			role: "user",
			channel: "speech",
			text: "Revise the plan through speech",
		});
		expect(component.getView()).toMatchObject({
			presentation: { draft: "Keep this typed draft" },
		});
		expect(fetchMock).toHaveBeenCalledTimes(6);

		const incompletePrompt = host.shadowRoot.querySelector("textarea");
		const incompleteForm = host.shadowRoot.querySelector("form");
		if (
			!(incompletePrompt instanceof HTMLTextAreaElement) ||
			!(incompleteForm instanceof HTMLFormElement)
		) {
			throw new Error("voice workbench incomplete-turn form is unavailable");
		}
		incompletePrompt.value = "Revise but omit the response";
		incompletePrompt.dispatchEvent(new Event("input", { bubbles: true }));
		incompleteForm.dispatchEvent(
			new Event("submit", { bubbles: true, cancelable: true }),
		);
		await vi.waitFor(() => {
			expect(component.getView()).toMatchObject({
				status: "ready",
				artifacts: [{ id: "release-plan", revision: "4" }],
				response: {
					text: "The accepted revision is complete.",
				},
				presentation: {
					turn: {
						type: "accepted",
						trace: [
							{ command: "reviseArtifact", accepted: true },
							{ command: "completeResponse", accepted: true },
						],
					},
				},
			});
			expect(host.shadowRoot?.textContent).toContain(
				"Actor accepted the model-authored turn.",
			);
		});
		expect(fetchMock).toHaveBeenCalledTimes(8);

		const recoveryPrompt = host.shadowRoot.querySelector("textarea");
		const recoveryForm = host.shadowRoot.querySelector("form");
		if (
			!(recoveryPrompt instanceof HTMLTextAreaElement) ||
			!(recoveryForm instanceof HTMLFormElement)
		) {
			throw new Error("voice workbench recovery form is unavailable");
		}
		recoveryPrompt.value = "Show provider recovery";
		recoveryPrompt.dispatchEvent(new Event("input", { bubbles: true }));
		recoveryForm.dispatchEvent(
			new Event("submit", { bubbles: true, cancelable: true }),
		);
		await vi.waitFor(() => {
			expect(component.getView()).toMatchObject({
				status: "ready",
				response: null,
				presentation: {
					turn: {
						type: "model-failed",
						failureKind: "network",
						message:
							"The local model could not be reached. Check its configuration and try again.",
					},
				},
			});
		});
		expect(fetchMock).toHaveBeenCalledTimes(9);

		if (!FakeSpeechRecognition.current) {
			throw new Error("speech recognition was not initialized");
		}
		FakeSpeechRecognition.current.denied = true;
		const currentMicrophone = host.shadowRoot.querySelector("#mic-button");
		if (!(currentMicrophone instanceof HTMLButtonElement)) {
			throw new Error("microphone button is unavailable after recovery");
		}
		currentMicrophone.click();
		expect(component.getView()).toMatchObject({
			presentation: { draft: "Show provider recovery" },
		});
		expect(
			host.shadowRoot.querySelector('[role="alert"]')?.textContent,
		).toContain("Microphone access was denied");
		expect(FakeSpeechRecognition.current.start).toHaveBeenCalledTimes(2);
		expect(
			component.getSnapshot().context.childLifecycles.voiceCapture,
		).toMatchObject({
			state: "permission-denied",
			attemptId: "voice:2",
			sequence: 2,
		});
		expect(component.getView().portRequests.voiceCapture).toBeNull();
		expect(component.getSnapshot().context.voiceCaptureControlSequence).toBe(3);

		FakeSpeechRecognition.current.denied = false;
		const permissionRetryMicrophone =
			host.shadowRoot.querySelector("#mic-button");
		if (!(permissionRetryMicrophone instanceof HTMLButtonElement)) {
			throw new Error(
				"microphone button is unavailable after permission denial",
			);
		}
		permissionRetryMicrophone.click();
		await vi.waitFor(() => {
			expect(FakeSpeechRecognition.current?.start).toHaveBeenCalledTimes(3);
			expect(
				component.getSnapshot().context.childLifecycles.voiceCapture,
			).toMatchObject({
				state: "listening",
				attemptId: "voice:3",
				sequence: 3,
			});
			expect(component.getView().portRequests.voiceCapture).toBeNull();
			expect(component.getSnapshot().context.voiceCaptureControlSequence).toBe(
				4,
			);
		});

		FakeSpeechRecognition.current.onerror?.({
			error: "network",
			message: "Recognition failed.",
		});
		await vi.waitFor(() => {
			expect(
				component.getSnapshot().context.childLifecycles.voiceCapture,
			).toMatchObject({
				state: "failed",
				attemptId: "voice:3",
				sequence: 3,
			});
		});
		expect(component.getView().portRequests.voiceCapture).toBeNull();
		const failureRetryMicrophone = host.shadowRoot.querySelector("#mic-button");
		if (!(failureRetryMicrophone instanceof HTMLButtonElement)) {
			throw new Error(
				"microphone button is unavailable after recognition failure",
			);
		}
		failureRetryMicrophone.click();
		await vi.waitFor(() => {
			expect(FakeSpeechRecognition.current?.start).toHaveBeenCalledTimes(4);
			expect(
				component.getSnapshot().context.childLifecycles.voiceCapture,
			).toMatchObject({
				state: "listening",
				attemptId: "voice:4",
				sequence: 4,
			});
			expect(component.getView().portRequests.voiceCapture).toBeNull();
			expect(component.getSnapshot().context.voiceCaptureControlSequence).toBe(
				5,
			);
		});

		deferNextModelRequest = true;
		const pagehidePrompt = host.shadowRoot.querySelector("textarea");
		const pagehideForm = host.shadowRoot.querySelector("form");
		if (
			!(pagehidePrompt instanceof HTMLTextAreaElement) ||
			!(pagehideForm instanceof HTMLFormElement)
		) {
			throw new Error("voice workbench pagehide form is unavailable");
		}
		pagehidePrompt.value = "Keep this turn pending through pagehide";
		pagehidePrompt.dispatchEvent(new Event("input", { bubbles: true }));
		pagehideForm.dispatchEvent(
			new Event("submit", { bubbles: true, cancelable: true }),
		);
		await vi.waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(10);
			expect(component.getView().status).toBe("responding");
		});
		const pendingTurnSignal = fetchMock.mock.calls[9]?.[1]?.signal;
		expect(pendingTurnSignal).toBeInstanceOf(AbortSignal);
		const pendingTurnAbort = vi.fn();
		pendingTurnSignal?.addEventListener("abort", pendingTurnAbort);

		const persistedPagehide = new Event("pagehide");
		Object.defineProperty(persistedPagehide, "persisted", { value: true });
		window.dispatchEvent(persistedPagehide);
		expect(source.getSnapshot().status).toBe("active");
		expect(pendingTurnSignal?.aborted).toBe(false);
		const terminalDisposalCount = stopSpeechActor.mock.calls.length;
		window.dispatchEvent(new Event("pagehide"));
		expect(source.getSnapshot().status).toBe("stopped");
		expect(pendingTurnSignal?.aborted).toBe(true);
		expect(pendingTurnAbort).toHaveBeenCalledOnce();
		window.dispatchEvent(new Event("pagehide"));
		expect(pendingTurnAbort).toHaveBeenCalledOnce();
		expect(stopSpeechActor).toHaveBeenCalledTimes(terminalDisposalCount);

		resolveDeferredModelRequest(
			new Response(
				JSON.stringify(
					completion([
						{
							name: "createArtifact",
							input: {
								id: "pagehide-stale-artifact",
								nodes: [
									{
										id: "copy",
										kind: "text",
										text: "Must not be committed after disposal.",
									},
								],
							},
						},
					]),
				),
				{ status: 200 },
			),
		);
		await Promise.resolve();
		expect(
			component
				.getSnapshot()
				.context.documents.some(
					(document) => document.id === "pagehide-stale-artifact",
				),
		).toBe(false);
	});
});
