// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SpeechRecognitionLike } from "./voice";

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
		document.body.innerHTML = `
			<voice-workbench></voice-workbench>
			<output id="document-commit"></output>
			<output id="speech-commit"></output>
		`;
	});

	it("creates and revises the center document through real text and speech paths", async () => {
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
		];
		const fetchMock = vi.fn(async () => {
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
			status: "ready",
			artifacts: [],
			messageCount: 0,
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
			expect(document.querySelector("#document-commit")?.textContent).toBe(
				"Committed Release plan revision 1",
			);
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

		prompt.value = "Keep this typed draft";
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
			expect(document.querySelector("#document-commit")?.textContent).toBe(
				"Committed Release plan revision 2",
			);
		});
		expect(component.getView().messages).toContainEqual({
			role: "user",
			channel: "speech",
			text: "Revise the plan through speech",
		});
		expect(prompt.value).toBe("Keep this typed draft");
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(terminal).toHaveBeenCalled();

		host.dispatchEvent(
			new CustomEvent("workbench-prompt", {
				detail: { channel: "text", text: "Show provider recovery" },
			}),
		);
		await vi.waitFor(() => {
			expect(component.getView()).toMatchObject({
				status: "ready",
				response: {
					text: "The local model could not be reached. Check its configuration and try again.",
				},
			});
			expect(host.shadowRoot?.querySelector("#turn-result")?.textContent).toBe(
				"The local model could not be reached. Check its configuration and try again.",
			);
		});
		expect(fetchMock).toHaveBeenCalledTimes(3);

		if (!FakeSpeechRecognition.current) {
			throw new Error("speech recognition was not initialized");
		}
		FakeSpeechRecognition.current.denied = true;
		const currentMicrophone = host.shadowRoot.querySelector("#mic-button");
		if (!(currentMicrophone instanceof HTMLButtonElement)) {
			throw new Error("microphone button is unavailable after recovery");
		}
		currentMicrophone.click();
		expect(prompt.value).toBe("Keep this typed draft");
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
