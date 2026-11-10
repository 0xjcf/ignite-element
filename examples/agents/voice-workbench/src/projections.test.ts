import { describe, expect, it, vi } from "vitest";
import { observeWorkbenchDocuments } from "./artifact-observer";
import {
	createVoiceWorkbenchSessionActor,
	type VoiceWorkbenchSessionActor,
} from "./session";
import {
	createVoiceWorkbenchComponent,
	type VoiceWorkbenchComponent,
} from "./workbench-component";

const makeAvailable = (source: VoiceWorkbenchSessionActor) => {
	const request = source.getSnapshot().context.portRequests.modelPreparation;
	if (!request) throw new Error("Expected model preparation.");
	source.send({
		type: "MODEL_PREPARATION_PORT_RECEIVED",
		request,
		receipt: { type: "available", sequence: request.sequence },
	});
};

const completeCurrentTurn = (
	source: VoiceWorkbenchSessionActor,
	component: VoiceWorkbenchComponent,
) => {
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
						id: "projection-complete",
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
				id: request.call.id ?? "projection-complete",
				command: request.call.command,
				status: "accepted",
				view: component.get("states").modelContext,
				events: [],
			},
		},
	});
};

describe("voice workbench application projections", () => {
	it("commits documents through observation and acknowledges source-owned speech", async () => {
		const source = createVoiceWorkbenchSessionActor().start();
		const component = createVoiceWorkbenchComponent(source);
		const commitDocument = vi.fn();
		let documentSession: { dispose(): void } | undefined;

		try {
			makeAvailable(source);
			documentSession = observeWorkbenchDocuments(component, commitDocument);

			await component.execute({
				command: "submitPrompt",
				input: { modality: "text", text: "Capture a decision" },
			});
			await component.execute({
				command: "createArtifact",
				input: {
					id: "decision",
					title: "Decision",
					nodes: [
						{
							kind: "decision-log",
							id: "decision-entries",
							entries: [
								{
									id: "runtime",
									title: "Runtime",
									decision: "Use Ignite",
									rationale: "One behavior model",
								},
							],
						},
					],
				},
			});
			await vi.waitFor(() =>
				expect(commitDocument).toHaveBeenLastCalledWith(
					expect.objectContaining({ id: "decision", revision: "1" }),
				),
			);

			await component.execute({
				command: "completeResponse",
				input: { text: "Decision captured.", speech: "Decision captured." },
			});
			completeCurrentTurn(source, component);
			const speech = component.get("states").speech;
			expect(speech).toMatchObject({
				text: "Decision captured.",
				status: "pending",
			});
			if (!speech) throw new Error("Expected source-owned speech request");
			await component.execute({
				command: "acknowledgeSpeech",
				input: { id: speech.id },
			});
			expect(component.get("states").speech).toMatchObject({
				status: "acknowledged",
			});
		} finally {
			documentSession?.dispose();
			component.dispose();
			source.stop();
		}
	});
});
