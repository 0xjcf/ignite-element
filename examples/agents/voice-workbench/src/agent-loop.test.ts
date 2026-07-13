import { afterAll, describe, expect, it, vi } from "vitest";
import {
	type ModelRequest,
	type ModelResult,
	runModelTurn,
} from "./agent-loop";
import { component, source } from "./session";

const nodes = [
	{
		kind: "checklist",
		id: "plan-items",
		items: [{ id: "draft", label: "Draft", checked: false }],
	},
] as const;

afterAll(() => source.stop());

describe("voice/text workbench model turn", () => {
	it("uses direct component tools across allowed and rejected turns", async () => {
		const responses: readonly ModelResult[] = [
			{
				ok: true,
				calls: [
					{
						command: "createArtifact",
						input: { id: "plan", title: "Plan", nodes },
					},
					{
						command: "completeResponse",
						input: { text: "Plan ready.", speech: "Plan ready." },
					},
				],
			},
			{
				ok: true,
				calls: [
					{
						command: "reviseArtifact",
						input: {
							artifactId: "plan",
							expectedRevision: "1",
							nodes: [
								{
									kind: "checklist",
									id: "plan-items",
									items: [{ id: "draft", label: "Draft", checked: true }],
								},
							],
						},
					},
					{
						command: "completeResponse",
						input: { text: "Plan revised.", speech: "Plan revised." },
					},
				],
			},
			{
				ok: true,
				calls: [
					{
						command: "createArtifact",
						input: {
							id: "unsafe-chart",
							title: "Unsafe chart",
							nodes: [
								{
									kind: "chart",
									id: "progress",
									chartType: "radar",
									series: [{ id: "ready", label: "Ready" }],
								},
							],
						},
					},
				],
			},
			{
				ok: true,
				calls: [{ command: "renderJavascript", input: { source: "alert(1)" } }],
			},
		];
		const requests: ModelRequest[] = [];
		const model = async (request: ModelRequest): Promise<ModelResult> => {
			requests.push(request);
			return responses[requests.length - 1] ?? { ok: true, calls: [] };
		};

		const first = await runModelTurn({
			component,
			model,
			prompt: { channel: "text", text: "Make a plan" },
		});
		const second = await runModelTurn({
			component,
			model,
			prompt: { channel: "speech", text: "Revise it" },
		});
		const malformed = await runModelTurn({
			component,
			model,
			prompt: { channel: "text", text: "Render an invalid chart" },
		});
		const rejected = await runModelTurn({
			component,
			model,
			prompt: { channel: "text", text: "Run code" },
		});

		expect(first.accepted).toBe(true);
		expect(second.accepted).toBe(true);
		expect(malformed).toEqual({
			accepted: false,
			reason: "command-rejected",
			command: "createArtifact",
			trace: [
				{ command: "createArtifact", accepted: false },
				{ command: "completeResponse", accepted: true },
			],
		});
		expect(requests[0]?.tools.map((tool) => tool.name)).toEqual([
			"completeResponse",
			"createArtifact",
		]);
		expect(requests[1]?.tools.map((tool) => tool.name)).toEqual([
			"completeResponse",
			"createArtifact",
			"reviseArtifact",
		]);
		expect(
			requests.flatMap((request) => request.tools.map((tool) => tool.name)),
		).not.toContain("acknowledgeSpeech");
		expect(rejected).toEqual({
			accepted: false,
			reason: "command-not-allowed",
			command: "renderJavascript",
			trace: [{ command: "completeResponse", accepted: true }],
		});
		expect(component.getView()).toMatchObject({
			status: "ready",
			artifacts: [{ id: "plan", revision: "2" }],
		});
	});

	it("recovers provider failure facts to ready with a sanitized visible error", async () => {
		const failed = await runModelTurn({
			component,
			model: async () => ({
				ok: false,
				error: {
					kind: "network",
					message: "secret provider address and stack",
				},
			}),
			prompt: { channel: "text", text: "Create a decision log" },
		});

		expect(failed).toEqual({
			accepted: false,
			reason: "model-failed",
			failure: {
				kind: "network",
				message:
					"The local model could not be reached. Check its configuration and try again.",
			},
			trace: [{ command: "completeResponse", accepted: true }],
		});
		expect(component.getView()).toMatchObject({
			status: "ready",
			response: {
				text: "The local model could not be reached. Check its configuration and try again.",
			},
		});
	});

	it("normalizes an unexpected provider throw through the same recovery path", async () => {
		const failed = await runModelTurn({
			component,
			model: async () => {
				throw new Error("secret provider failure");
			},
			prompt: { channel: "speech", text: "Revise the artifact" },
		});

		expect(failed).toMatchObject({
			accepted: false,
			reason: "model-failed",
			failure: {
				kind: "provider",
				message: "The local model could not complete this turn. Try again.",
			},
		});
		expect(component.getView()).toMatchObject({ status: "ready" });
	});

	it("recovers an admitted model turn that omits completeResponse", async () => {
		const incomplete = await runModelTurn({
			component,
			model: async () => ({
				ok: true,
				calls: [
					{
						command: "createArtifact",
						input: {
							id: "incomplete-turn",
							title: "Incomplete turn",
							nodes,
						},
					},
				],
			}),
			prompt: { channel: "text", text: "Create without completing" },
		});

		expect(incomplete).toEqual({
			accepted: false,
			reason: "response-incomplete",
			trace: [
				{ command: "createArtifact", accepted: true },
				{ command: "completeResponse", accepted: true },
			],
		});
		expect(component.getView()).toMatchObject({
			status: "ready",
			response: {
				text: "The model did not complete the response. Refine the prompt and try again.",
			},
		});
	});

	it("does not invoke the model when submitPrompt is not admitted", async () => {
		await component.execute({
			command: "submitPrompt",
			input: { modality: "text", text: "Keep this turn active" },
		});
		const beforeRejectedPrompt = component.getView();
		const model = vi.fn(
			async (): Promise<ModelResult> => ({
				ok: true,
				calls: [],
			}),
		);

		const rejected = await runModelTurn({
			component,
			model,
			prompt: { channel: "speech", text: "Do not admit this prompt" },
		});

		expect(rejected).toEqual({
			accepted: false,
			reason: "prompt-rejected",
			trace: [],
		});
		expect(model).not.toHaveBeenCalled();
		expect(component.getView()).toEqual(beforeRejectedPrompt);

		await component.execute({
			command: "completeResponse",
			input: { text: "Active turn completed after rejection proof." },
		});
	});
});
