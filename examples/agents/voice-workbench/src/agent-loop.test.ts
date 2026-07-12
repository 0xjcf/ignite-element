import { describe, expect, it, vi } from "vitest";
import type { VoiceWorkbenchComponent as Component } from "./session";

type ModelResponse = {
	calls: readonly { command: string; input: unknown }[];
};

type ModelRequest = {
	tools: readonly { name: string }[];
};

type ScriptedModel = ((request: ModelRequest) => Promise<ModelResponse>) & {
	requests: ModelRequest[];
};

const loadWorkbench = async () => {
	vi.resetModules();
	const session = (await import("./session")) as Record<string, unknown>;
	const loop = (await import("./agent-loop")) as Record<string, unknown>;
	expect(typeof session.component).toBe("function");
	expect(typeof (session.source as { stop?: unknown } | undefined)?.stop).toBe(
		"function",
	);
	expect(
		typeof loop.runModelTurn,
		"agent loop must export plain runModelTurn({ component, model, prompt })",
	).toBe("function");
	expect(typeof loop.createScriptedModel).toBe("function");
	return {
		component: session.component as Component,
		source: session.source as { stop(): void },
		runModelTurn: loop.runModelTurn as (options: {
			component: Component;
			model: ScriptedModel;
			prompt: { channel: "text" | "speech"; text: string };
		}) => Promise<{ accepted: boolean; trace: readonly { command: string }[] }>,
		createScriptedModel: loop.createScriptedModel as (
			responses: readonly ModelResponse[],
		) => ScriptedModel,
	};
};

describe("voice/text workbench model turn", () => {
	it("filters the live igniteTools manifest for two continuing turns", async () => {
		const { component, source, runModelTurn, createScriptedModel } =
			await loadWorkbench();
		const model = createScriptedModel([
			{
				calls: [
					{
						command: "createArtifact",
						input: {
							id: "plan",
							title: "Plan",
							kind: "checklist",
							nodes: [
								{
									type: "checklist",
									items: [{ text: "Draft", checked: false }],
								},
							],
						},
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
							expectedRevision: 1,
							nodes: [
								{
									type: "checklist",
									items: [{ text: "Draft", checked: true }],
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
		]);

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

		expect(first.accepted).toBe(true);
		expect(second.accepted).toBe(true);
		expect(model.requests[0]?.tools.map((tool) => tool.name)).toEqual([
			"completeResponse",
			"createArtifact",
		]);
		expect(model.requests[1]?.tools.map((tool) => tool.name)).toEqual([
			"completeResponse",
			"createArtifact",
			"reviseArtifact",
		]);
		expect(
			[...first.trace, ...second.trace].map((entry) => entry.command),
		).toEqual([
			"createArtifact",
			"completeResponse",
			"reviseArtifact",
			"completeResponse",
		]);
		expect(component.getView()).toMatchObject({
			status: "ready",
			artifactCount: 1,
			messageCount: 4,
		});
		source.stop();
	});

	it("rejects non-allowlisted calls before execution", async () => {
		const { component, source, runModelTurn, createScriptedModel } =
			await loadWorkbench();
		const model = createScriptedModel([
			{
				calls: [{ command: "renderJavascript", input: { source: "alert(1)" } }],
			},
		]);

		const result = await runModelTurn({
			component,
			model,
			prompt: { channel: "text", text: "Run code" },
		});
		expect(result).toEqual({
			accepted: false,
			reason: "command-not-allowed",
			command: "renderJavascript",
			trace: [],
		});
		expect(component.getView().artifactCount).toBe(0);
		source.stop();
	});
});
