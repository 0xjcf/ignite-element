/// <reference types="node" />

import "@ignite-element/renderer/jsx";
import type { ModelTurnPortRequest } from "./model-turn";
import { createVoiceWorkbenchSessionActor } from "./session";
import { createVoiceWorkbenchComponent } from "./workbench-component";

const source = createVoiceWorkbenchSessionActor().start();
const component = createVoiceWorkbenchComponent(source);

const modelPreparation =
	source.getSnapshot().context.portRequests.modelPreparation;
if (!modelPreparation) throw new Error("Expected model preparation request.");
source.send({
	type: "MODEL_PREPARATION_PORT_RECEIVED",
	request: modelPreparation,
	receipt: { type: "available", sequence: modelPreparation.sequence },
});

const currentModelTurnRequest = (): ModelTurnPortRequest => {
	const request = source.getSnapshot().context.portRequests.modelTurn;
	if (!request) throw new Error("Expected a model-turn request.");
	return request;
};

const completeHeadlessTurn = () => {
	let request = currentModelTurnRequest();
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
						id: "headless-complete",
						command: "completeResponse",
						input: { text: "Headless proof complete." },
					},
				],
			},
		},
	});
	request = currentModelTurnRequest();
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
	request = currentModelTurnRequest();
	if (request.type !== "execute-call") {
		throw new Error("Expected an executable headless model proposal.");
	}
	source.send({
		type: "MODEL_TURN_PORT_RECEIVED",
		request,
		receipt: {
			type: "CAPABILITY_RESOLVED",
			turnId: request.turnId,
			attemptId: request.attemptId,
			feedback: {
				id: request.call.id ?? "headless-complete",
				command: request.call.command,
				status: "accepted",
				ownerId: "voice-workbench-headless-proof",
				view: component.getStates().modelContext,
				events: [],
			},
		},
	});
};

try {
	await component.execute({
		command: "submitPrompt",
		input: { modality: "text", text: "Prove the headless artifact contract" },
	});
	await component.execute({
		command: "createArtifact",
		input: {
			id: "headless-proof",
			title: "Headless proof",
			nodes: [
				{
					id: "proof-items",
					kind: "checklist",
					items: [
						{
							id: "actor-authorized",
							label: "Actor authorized",
							checked: false,
						},
					],
				},
				{
					id: "proof-summary",
					kind: "text",
					text: "The same component runs without a browser.",
				},
			],
		},
	});
	await component.execute({
		command: "setChecklistItem",
		input: {
			artifactId: "headless-proof",
			expectedRevision: "1",
			nodeId: "proof-items",
			itemId: "actor-authorized",
			checked: true,
		},
	});
	await component.execute({
		command: "completeResponse",
		input: { text: "Headless proof complete." },
	});
	completeHeadlessTurn();

	const view = component.getStates();
	if (view.status !== "ready") throw new Error("Expected ready status.");
	if (view.response?.text !== "Headless proof complete.") {
		throw new Error("Expected the completed headless response.");
	}
	if (view.activeArtifact?.id !== "headless-proof") {
		throw new Error("Expected the headless proof artifact.");
	}
	if (view.activeArtifactRevisions.length !== 2) {
		throw new Error("Expected both artifact revisions.");
	}
	const checklist = view.activeArtifact?.nodes.find(
		(node) => node.id === "proof-items",
	);
	if (checklist?.kind !== "checklist") throw new Error("Expected a checklist.");
	if (
		checklist.items.find((item) => item.id === "actor-authorized")?.checked !==
		true
	) {
		throw new Error("Expected the actor-authorized item to be checked.");
	}
	if (!component.getSnapshot().matches({ available: { turn: "idle" } })) {
		throw new Error("Expected the source to reach the idle turn state.");
	}
	process.stdout.write(
		JSON.stringify(
			{
				matches: component.getSnapshot().value,
				artifact: view.activeArtifact,
				revisions: view.activeArtifactRevisions,
				response: view.response,
			},
			null,
			2,
		) + "\n",
	);
} finally {
	source.stop();
}
