import { describe, expect, it } from "vitest";
import {
	type ModelRequest,
	type ModelResponse,
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

describe("voice/text workbench model turn", () => {
	it("uses direct component tools across allowed and rejected turns", async () => {
		const responses: readonly ModelResponse[] = [
			{
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
				calls: [{ command: "renderJavascript", input: { source: "alert(1)" } }],
			},
		];
		const requests: ModelRequest[] = [];
		const model = async (request: ModelRequest): Promise<ModelResponse> => {
			requests.push(request);
			return responses[requests.length - 1] ?? { calls: [] };
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
		const rejected = await runModelTurn({
			component,
			model,
			prompt: { channel: "text", text: "Run code" },
		});

		expect(first.accepted).toBe(true);
		expect(second.accepted).toBe(true);
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
			trace: [],
		});
		expect(component.getView()).toMatchObject({
			artifacts: [{ id: "plan", revision: "2" }],
		});
		source.stop();
	});
});
