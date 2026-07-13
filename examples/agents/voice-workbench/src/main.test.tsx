// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import agentLoopSource from "./agent-loop.ts?raw";
import mainSource from "./main.tsx?raw";
import modelSource from "./model.ts?raw";
import type { SpeechRecognitionLike } from "./voice";
import voiceSource from "./voice.ts?raw";
import workbenchSource from "./workbench.tsx?raw";

const completion = (calls: Array<{ name: string; input: unknown }>) => ({
	choices: [
		{
			message: {
				role: "assistant",
				tool_calls: calls.map((call, index) => ({
					id: `call-${index}`,
					type: "function",
					function: {
						name: call.name,
						arguments: JSON.stringify(call.input),
					},
				})),
			},
		},
	],
});

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

	beforeEach(() => {
		speak.mockReset();
		FakeSpeechRecognition.current = null;
		vi.stubEnv("MLX_BASE_URL", "http://127.0.0.1:8080/v1");
		vi.stubEnv("MLX_MODEL", "consumer-selected-model");
		vi.stubGlobal("SpeechRecognition", FakeSpeechRecognition);
		vi.stubGlobal(
			"SpeechSynthesisUtterance",
			class SpeechSynthesisUtterance {
				constructor(readonly text: string) {}
			},
		);
		Object.defineProperty(window, "speechSynthesis", {
			configurable: true,
			value: { speak },
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
		expect(modelSource).not.toContain("createMlxWorkbenchModel");
		expect(modelSource).not.toMatch(/\bcomponent\b/);
		expect(modelSource).not.toMatch(/\bfetch\?:/);
		expect(voiceSource).not.toContain("createRecognition");
	});

	it("creates and revises the center document through real text and speech paths", async () => {
		let resolveReadiness: (response: Response) => void = () => {};
		const readiness = new Promise<Response>((resolve) => {
			resolveReadiness = resolve;
		});
		let firstRequest = true;
		const responses = [
			completion([
				{
					name: "createArtifact",
					input: {
						id: "release-plan",
						title: "Release plan",
						nodes: [
							{
								kind: "text",
								id: "summary",
								text: "Start with a deterministic proof.",
							},
						],
					},
				},
				{
					name: "completeResponse",
					input: {
						text: "The release plan is ready.",
						speech: "The release plan is ready.",
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
								kind: "text",
								id: "summary",
								text: "Add a speech-authored rollout checkpoint.",
							},
						],
					},
				},
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
						expectedRevision: "2",
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
		const fetchMock = vi.fn(async () => {
			if (firstRequest) {
				firstRequest = false;
				return readiness;
			}
			const response = responses.shift();
			if (!response) throw new Error("unexpected model request");
			return new Response(JSON.stringify(response), { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);
		const terminal = vi.spyOn(console, "info").mockImplementation(() => {});

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
		prompt.value = "Create a release plan";
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
						title: "Release plan",
						revision: "1",
					},
				],
			});
			expect(host.shadowRoot?.textContent).toContain(
				"Start with a deterministic proof.",
			);
			expect(component.getView()).toMatchObject({
				presentation: {
					documentCommit: {
						id: "release-plan",
						revision: "1",
						title: "Release plan",
					},
					speechCommit: {
						text: "The release plan is ready.",
						status: "played",
					},
				},
			});
			expect(speak).toHaveBeenCalledWith(
				expect.objectContaining({ text: "The release plan is ready." }),
			);
		});

		const schemaTab = host.shadowRoot.querySelector("#schema-tab");
		if (!(schemaTab instanceof HTMLButtonElement)) {
			throw new Error("schema tab is unavailable");
		}
		schemaTab.click();
		expect(schemaTab.getAttribute("aria-selected")).toBe("true");
		expect(
			host.shadowRoot.querySelector(".schema-view")?.textContent,
		).toContain('"revision": "1"');

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
			expect(component.getView()).toMatchObject({
				status: "ready",
				artifacts: [{ id: "release-plan", revision: "2" }],
			});
			expect(host.shadowRoot?.textContent).toContain(
				"Add a speech-authored rollout checkpoint.",
			);
			expect(component.getView()).toMatchObject({
				presentation: {
					documentCommit: { id: "release-plan", revision: "2" },
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
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(terminal).toHaveBeenCalled();

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
				artifacts: [{ id: "release-plan", revision: "3" }],
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
		expect(fetchMock).toHaveBeenCalledTimes(5);

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
				response: {
					text: "The local model could not be reached. Check its configuration and try again.",
				},
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
		expect(fetchMock).toHaveBeenCalledTimes(6);

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

		const persistedPagehide = new Event("pagehide");
		Object.defineProperty(persistedPagehide, "persisted", { value: true });
		window.dispatchEvent(persistedPagehide);
		expect(source.getSnapshot().status).toBe("active");
		window.dispatchEvent(new Event("pagehide"));
		expect(source.getSnapshot().status).toBe("stopped");
		terminal.mockRestore();
	});
});
