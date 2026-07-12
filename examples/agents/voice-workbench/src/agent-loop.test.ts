import { describe, expect, it } from "vitest";

const loadAgentLoop = async () => {
	const agentLoop = await import("./agent-loop").catch(() => null);
	expect(
		agentLoop,
		"the deterministic voice/text agent loop has not been implemented",
	).not.toBeNull();
	return agentLoop as NonNullable<typeof agentLoop>;
};

describe("voice/text workbench agent loop", () => {
	it("uses the exact allowlist and continues one session across text and speech", async () => {
		const { createScriptedModel, createWorkbenchAgent } = await loadAgentLoop();
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
				],
			},
			{
				calls: [
					{
						command: "completeResponse",
						input: { text: "Plan ready.", speech: "Plan ready." },
					},
				],
			},
		]);
		const agent = createWorkbenchAgent({ sessionId: "session-1", model });

		await agent.receive({ channel: "text", text: "Make a plan" });
		await agent.receive({ channel: "speech", text: "Read it back" });

		expect(model.requests).toHaveLength(2);
		expect(model.requests[0]?.tools.map((tool) => tool.name)).toEqual([
			"completeResponse",
			"createArtifact",
			"reviseArtifact",
		]);
		expect(agent.runtime.getView()).toMatchObject({
			sessionId: "session-1",
			artifactCount: 1,
			messageCount: 4,
			response: { text: "Plan ready.", speech: "Plan ready." },
		});
		expect(agent.trace.map((entry) => entry.command)).toEqual([
			"createArtifact",
			"completeResponse",
		]);
		agent.close();
	});

	it("returns rejected tool facts and never executes unallowlisted model calls", async () => {
		const { createScriptedModel, createWorkbenchAgent } = await loadAgentLoop();
		const model = createScriptedModel([
			{
				calls: [{ command: "renderJavascript", input: { source: "alert(1)" } }],
			},
		]);
		const agent = createWorkbenchAgent({ sessionId: "session-1", model });

		const result = await agent.receive({ channel: "text", text: "Run code" });
		expect(result).toEqual({
			accepted: false,
			reason: "command-not-allowed",
			command: "renderJavascript",
		});
		expect(agent.runtime.getView().artifactCount).toBe(0);
		agent.close();
	});
});
