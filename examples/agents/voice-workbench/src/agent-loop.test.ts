import { igniteTools, isOk } from "ignite-element/tools";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	type ModelRequest,
	type ModelResult,
	modelTools,
	modelTurn,
} from "./agent-loop";
import { component, source } from "./session";

const nodes = [
	{
		kind: "checklist",
		id: "plan-items",
		items: [{ id: "draft", label: "Draft", checked: false }],
	},
] as const;

beforeAll(() => component.execute({ command: "reportModelAvailable" }));
afterAll(() => source.stop());

const executeModelTurn = async (response: ModelResult) => {
	const tools = igniteTools(component);
	const protocol = modelTurn(response);
	let step = protocol.next();
	while (!step.done) {
		const call = step.value;
		const execution = await tools.run({
			name: call.command,
			input: call.input,
		});
		const rejectedByActor =
			isOk(execution) &&
			execution.value.events.some(
				(actorEvent) => actorEvent.type === "artifact-rejected",
			);
		step = protocol.next(isOk(execution) && !rejectedByActor);
	}
	return step.value;
};

describe("voice/text workbench model turn", () => {
	it("admits at most one artifact mutation per model response", () => {
		const input = { id: "plan", nodes };
		const protocol = modelTurn({
			ok: true,
			calls: [
				{ command: "createArtifact", input },
				{ command: "createArtifact", input },
			],
		});

		expect(protocol.next()).toMatchObject({
			done: false,
			value: { command: "createArtifact" },
		});
		expect(protocol.next(true)).toEqual({
			done: true,
			value: {
				accepted: false,
				reason: "response-incomplete",
				trace: [{ command: "createArtifact", accepted: true }],
			},
		});
	});

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
		const request = (prompt: ModelRequest["prompt"]): ModelResult => {
			const tools = igniteTools(component);
			const modelRequest = {
				prompt,
				tools: modelTools(tools.manifest),
				view: component.getView().modelContext,
			};
			requests.push(modelRequest);
			return responses[requests.length - 1] ?? { ok: true, calls: [] };
		};
		const turn = async (
			prompt: ModelRequest["prompt"],
		): ReturnType<typeof executeModelTurn> => {
			await component.execute({
				command: "submitPrompt",
				input: { modality: prompt.channel, text: prompt.text },
			});
			return executeModelTurn(request(prompt));
		};

		const first = await turn({ channel: "text", text: "Make a plan" });
		const second = await turn({ channel: "speech", text: "Revise it" });
		const malformed = await turn({
			channel: "text",
			text: "Render an invalid chart",
		});
		const rejected = await turn({ channel: "text", text: "Run code" });

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
		await component.execute({
			command: "submitPrompt",
			input: { modality: "text", text: "Create a decision log" },
		});
		const failed = await executeModelTurn({
			ok: false,
			error: {
				kind: "network",
				message: "secret provider address and stack",
			},
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

	it("normalizes provider failure facts through the same recovery path", async () => {
		await component.execute({
			command: "submitPrompt",
			input: { modality: "speech", text: "Revise the artifact" },
		});
		const failed = await executeModelTurn({
			ok: false,
			error: { kind: "provider", message: "secret provider failure" },
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

	it("leaves an incomplete admitted turn open for a completion round", async () => {
		await component.execute({
			command: "submitPrompt",
			input: { modality: "text", text: "Create without completing" },
		});
		const incomplete = await executeModelTurn({
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
		});

		expect(incomplete).toEqual({
			accepted: false,
			reason: "response-incomplete",
			trace: [{ command: "createArtifact", accepted: true }],
		});
		expect(component.getView()).toMatchObject({
			status: "responding",
			response: null,
		});
		await component.execute({
			command: "completeResponse",
			input: { text: "Follow-up round complete." },
		});
	});

	it("does not publish a prompt event when submitPrompt is not admitted", async () => {
		await component.execute({
			command: "submitPrompt",
			input: { modality: "text", text: "Keep this turn active" },
		});
		const beforeRejectedPrompt = component.getView();
		const promptSubmitted = vi.fn();
		const subscription = component.on("prompt-submitted", promptSubmitted);

		await component.execute({
			command: "submitPrompt",
			input: { modality: "speech", text: "Do not admit this prompt" },
		});

		expect(promptSubmitted).not.toHaveBeenCalled();
		expect(component.getView()).toEqual(beforeRejectedPrompt);
		subscription.unsubscribe();

		await component.execute({
			command: "completeResponse",
			input: { text: "Active turn completed after rejection proof." },
		});
	});
});
