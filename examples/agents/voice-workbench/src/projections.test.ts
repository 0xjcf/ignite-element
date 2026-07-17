import {
	createProjectionDocumentTarget,
	createProjectionSpeechTarget,
} from "ignite-element/xstate";
import { describe, expect, it, vi } from "vitest";
import { createVoiceWorkbenchSessionActor } from "./session";
import { createVoiceWorkbenchComponent } from "./workbench-component";

const source = createVoiceWorkbenchSessionActor().start();
const component = createVoiceWorkbenchComponent(source);

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
				view: component.getView().modelContext,
				events: [],
			},
		},
	});
};

describe("voice workbench projection targets", () => {
	it("commits documents and acknowledged speech through direct component targets", async () => {
		makeAvailable();
		const commitDocument = vi.fn();
		const commitSpeech = vi.fn();
		const documentSession = component(
			createProjectionDocumentTarget({ commitDocument }),
		);
		const speechSession = component(
			createProjectionSpeechTarget({
				commitSpeech,
				acknowledgeCommandName: "acknowledgeSpeech",
				resolveAcknowledgePayload: ({ id }) => ({ id }),
			}),
		);

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
		completeCurrentTurn();
		await vi.waitFor(() => {
			expect(commitSpeech).toHaveBeenCalledWith(
				expect.objectContaining({
					text: "Decision captured.",
					status: "pending",
				}),
			);
			expect(component.getView().speech).toMatchObject({
				text: "Decision captured.",
				status: "acknowledged",
			});
		});

		documentSession.dispose();
		speechSession.dispose();
		source.stop();
	});
});
