/// <reference types="node" />

import "@ignite-element/renderer/jsx";
import { test as igniteTest } from "ignite-element/testing";
import {
	component,
	recordTurnTerminal,
	reportModelAvailable,
	source,
} from "./session";

const story = component.record("voice-workbench-headless-proof");

reportModelAvailable();
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
const turnId = source.getSnapshot().context.activeTurnId;
if (turnId) recordTurnTerminal({ type: "TURN_COMPLETED", turnId });

const proof = igniteTest.snapshotStory(story);
const view = component.getView();
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
