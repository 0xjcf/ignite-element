/// <reference types="node" />

import "@ignite-element/renderer/jsx";
import { test as igniteTest } from "ignite-element/testing";
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

const story = component.record("voice-workbench-headless-proof");

await story.execute({
	command: "submitPrompt",
	input: { modality: "text", text: "Prove the headless artifact contract" },
});
await story.execute({
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
await story.execute({
	command: "setChecklistItem",
	input: {
		artifactId: "headless-proof",
		expectedRevision: "1",
		nodeId: "proof-items",
		itemId: "actor-authorized",
		checked: true,
	},
});
await story.execute({
	command: "completeResponse",
	input: { text: "Headless proof complete." },
});
completeHeadlessTurn();

const proof = igniteTest.snapshotStory(story);
const view = component.getStates();
const trace = proof.trace.flatMap((entry) =>
	entry.kind === "command"
		? [
				{
					step: entry.step,
					command: entry.command,
					...("payload" in entry ? { input: entry.payload } : {}),
				},
			]
		: [],
);

process.stdout.write(
	`${JSON.stringify(
		{
			name: proof.name,
			trace,
			events: proof.summary.events,
			final: {
				matches: component.getSnapshot().value,
				artifact: view.activeArtifact,
				revisions: view.activeArtifactRevisions,
				response: view.response,
			},
		},
		null,
		2,
	)}\n`,
);
source.stop();
