import { igniteTools } from "ignite-element/tools";
import {
	createProjectionDocumentTarget,
	createProjectionSpeechTarget,
} from "ignite-element/xstate";
import { component, source } from "./session";
import { renderWorkbench } from "./workbench";

component("voice-workbench", renderWorkbench);

const promptSubscription = component.on("prompt-submitted", async (event) => {
	const tools = igniteTools(component);
	const document = component
		.getSnapshot()
		.context.documents.find((candidate) => candidate.id === "browser-demo");
	const nodes = [
		{
			id: "browser-demo-summary",
			kind: "text",
			text: event.text,
		},
	];
	const committed = document
		? await tools.run({
				name: "reviseArtifact",
				input: {
					artifactId: document.id,
					expectedRevision: document.revision,
					nodes,
				},
			})
		: await tools.run({
				name: "createArtifact",
				input: {
					id: "browser-demo",
					title: "Browser demo",
					nodes,
				},
			});
	if (!committed.ok) return;

	const response = `Captured: ${event.text}`;
	await tools.run({
		name: "completeResponse",
		input: { text: response, speech: response },
	});
});

const documentProjection = component(
	createProjectionDocumentTarget({
		commitDocument: (projectionDocument) => {
			const output = document.querySelector("#document-commit");
			if (output) {
				output.textContent = `Committed ${projectionDocument.title ?? projectionDocument.id} revision ${projectionDocument.revision}`;
			}
		},
	}),
);

const speechProjection = component(
	createProjectionSpeechTarget({
		acknowledgeCommandName: "acknowledgeSpeech",
		resolveAcknowledgePayload: ({ id }) => ({ id }),
		commitSpeech: (speech) => {
			const output = document.querySelector("#speech-commit");
			if (output) output.textContent = speech.text;
			if (
				typeof window.speechSynthesis?.speak === "function" &&
				typeof SpeechSynthesisUtterance !== "undefined"
			) {
				window.speechSynthesis.speak(new SpeechSynthesisUtterance(speech.text));
			}
		},
	}),
);

window.addEventListener("pagehide", (event) => {
	if (event.persisted) return;
	promptSubscription.unsubscribe();
	documentProjection.dispose();
	speechProjection.dispose();
	source.stop();
});
