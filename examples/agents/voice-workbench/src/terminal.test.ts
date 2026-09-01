import { afterAll, describe, expect, it } from "vitest";
import { createVoiceWorkbenchSessionActor } from "./session";
import { formatTerminalProjection } from "./terminal";
import terminalSource from "./terminal.ts?raw";
import { createVoiceWorkbenchComponent } from "./workbench-component";

const source = createVoiceWorkbenchSessionActor().start();
const component = createVoiceWorkbenchComponent(source);

afterAll(() => source.stop());

const makeAvailable = () => {
	const request = source.getSnapshot().context.portRequests.modelPreparation;
	if (!request) throw new Error("Expected model preparation.");
	source.send({
		type: "MODEL_PREPARATION_PORT_RECEIVED",
		request,
		receipt: { type: "available", sequence: request.sequence },
	});
};

const completeCurrentTurn = () => {
	let request = source.getSnapshot().context.portRequests.modelTurn;
	if (!request) throw new Error("Expected a model request.");
	source.send({
		type: "MODEL_TURN_PORT_RECEIVED",
		request,
		receipt: {
			type: "MODEL_RESOLVED",
			turnId: request.turnId,
			attemptId: request.attemptId,
			result: {
				ok: true,
				calls: [
					{
						id: "terminal-complete",
						command: "completeResponse",
						input: source.getSnapshot().context.pendingCompletion,
					},
				],
			},
		},
	});
	request = source.getSnapshot().context.portRequests.modelTurn;
	if (!request) throw new Error("Expected authorization.");
	source.send({
		type: "MODEL_TURN_PORT_RECEIVED",
		request,
		receipt: {
			type: "AUTHORIZATION_RESOLVED",
			turnId: request.turnId,
			attemptId: request.attemptId,
			allowed: true,
		},
	});
	request = source.getSnapshot().context.portRequests.modelTurn;
	if (!request || request.type !== "execute-call") {
		throw new Error("Expected execution.");
	}
	source.send({
		type: "MODEL_TURN_PORT_RECEIVED",
		request,
		receipt: {
			type: "CAPABILITY_RESOLVED",
			turnId: request.turnId,
			attemptId: request.attemptId,
			feedback: {
				id: request.call.id ?? "terminal-complete",
				command: request.call.command,
				status: "accepted",
				view: component.getStates().modelContext,
				events: [],
			},
		},
	});
};

describe("voice workbench terminal projection", () => {
	it("formats the same actor-approved view without DOM APIs", async () => {
		makeAvailable();
		await component.execute({
			command: "submitPrompt",
			input: { modality: "text", text: "Create a terminal artifact" },
		});
		await component.execute({
			command: "createArtifact",
			input: {
				id: "terminal-artifact",
				title: "Terminal artifact",
				nodes: [
					{
						id: "summary",
						kind: "text",
						text: "Projected without a DOM.",
					},
				],
			},
		});
		await component.execute({
			command: "completeResponse",
			input: { text: "Terminal artifact ready." },
		});
		completeCurrentTurn();

		const view = component.getStates();
		const output = formatTerminalProjection(view);
		expect(output).toContain("Projection source: current actor view");
		expect(view.runtimeInspector.actor.matchText).toBe(
			'matches({\n  available: { turn: "idle" },\n})',
		);
		expect(output).toContain(view.runtimeInspector.actor.matchText);
		expect(output).not.toContain("provider:");
		expect(output).toContain(
			"Terminal artifact [terminal-artifact] · revision 1",
		);
		expect(output).toContain("text · summary");
		expect(output).toContain("Terminal artifact ready.");
		expect(terminalSource).not.toMatch(/document|window|HTMLElement/);
	});
});
