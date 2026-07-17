import { afterEach, describe, expect, it } from "vitest";
import {
	createVoiceWorkbenchSessionActor,
	type VoiceWorkbenchSessionActor,
} from "./session";
import { createVoiceWorkbenchComponent } from "./workbench-component";
import componentSource from "./workbench-component.ts?raw";
import viewSource from "./workbench-view.ts?raw";
import workbenchSource from "./workbench.tsx?raw";
import artifactSource from "./views/artifact.tsx?raw";
import conversationSource from "./views/conversation.tsx?raw";
import runtimeSource from "./views/runtime.tsx?raw";

const actors = new Set<VoiceWorkbenchSessionActor>();

afterEach(() => {
	for (const actor of actors) actor.stop();
	actors.clear();
});

const createFixture = () => {
	const actor = createVoiceWorkbenchSessionActor().start();
	actors.add(actor);
	return { actor, component: createVoiceWorkbenchComponent(actor) };
};

const makeAvailable = (actor: VoiceWorkbenchSessionActor) => {
	const request = actor.getSnapshot().context.portRequests.modelPreparation;
	if (!request) throw new Error("Expected model preparation.");
	actor.send({
		type: "MODEL_PREPARATION_PORT_RECEIVED",
		request,
		receipt: { type: "available", sequence: request.sequence },
	});
};

const commandNames = [
	"acknowledgeSpeech",
	"beginModelPreparation",
	"cancelVoiceCapture",
	"changeArtifactView",
	"changeDraft",
	"changeMobilePanel",
	"changeSpeechPreference",
	"completeResponse",
	"createArtifact",
	"playSpeech",
	"replay",
	"restoreArtifactRevision",
	"reviseArtifact",
	"selectArtifact",
	"selectRuntimePreview",
	"setChecklistItem",
	"startVoiceCapture",
	"submitPrompt",
	"submitVoiceTranscript",
].sort();

describe("voice workbench projections", () => {
	it("derives the exact 19-command blueprint independently for fresh components", async () => {
		const first = createFixture();
		const second = createFixture();
		makeAvailable(first.actor);
		await first.component.execute({ command: "changeDraft", input: "first only" });

		expect(Object.keys(first.component.getSchema().commands).sort()).toEqual(
			commandNames,
		);
		expect(Object.keys(second.component.getSchema().commands).sort()).toEqual(
			commandNames,
		);
		expect(first.component.getView()).toMatchObject({
			status: "ready",
			commandCount: 19,
			presentation: { draft: "first only" },
		});
		expect(second.component.getView()).toMatchObject({
			status: "preparing",
			commandCount: 19,
			presentation: { draft: "" },
		});
	});

	it("keeps state inspection and derived labels in the view projector, not JSX", () => {
		const rendererSources = [
			workbenchSource,
			artifactSource,
			conversationSource,
			runtimeSource,
		];
		for (const source of rendererSources) {
			expect(source).not.toContain("getSnapshot(");
			expect(source).not.toContain("snapshot.matches(");
			expect(source).not.toContain("snapshot.context");
		}

		expect(componentSource).toContain("projectVoiceWorkbenchView");
		expect(viewSource).toContain('snapshot.matches("preparing")');
		expect(viewSource).toContain("commandCount: blueprintRows.length");
		expect(viewSource).toContain("actorMatchText");
		expect(workbenchSource).toContain("context.commandCount");
	});
});
