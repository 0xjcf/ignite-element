import { afterEach, describe, expect, it } from "vitest";
import {
	createVoiceWorkbenchSessionActor,
	type VoiceWorkbenchSessionActor,
} from "./session";
import artifactSource from "./views/artifact.tsx?raw";
import conversationSource from "./views/conversation.tsx?raw";
import runtimeSource from "./views/runtime.tsx?raw";
import workbenchSource from "./workbench.tsx?raw";
import { createVoiceWorkbenchComponent } from "./workbench-component";
import componentSource from "./workbench-component.ts?raw";
import viewSource from "./workbench-view.ts?raw";

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

const availabilityCommandNames = [
	"acknowledgeSpeech",
	"cancelVoiceCapture",
	"completeResponse",
	"createArtifact",
	"restoreArtifactRevision",
	"reviseArtifact",
	"selectArtifact",
	"setChecklistItem",
	"startVoiceCapture",
	"submitPrompt",
	"submitVoiceTranscript",
] as const;

const expectProjectedCommandAvailability = (
	component: ReturnType<typeof createVoiceWorkbenchComponent>,
) => {
	const commandAvailability = Object.fromEntries(
		availabilityCommandNames.map((name) => [name, component.canExecute(name)]),
	);
	expect(component.getStates()).toMatchObject({ commandAvailability });
};

const cancelActiveTurn = (actor: VoiceWorkbenchSessionActor) => {
	const request = actor.getSnapshot().context.portRequests.modelTurn;
	if (!request) throw new Error("Expected an active model-turn request.");
	actor.send({
		type: "MODEL_TURN_CANCEL_REQUESTED",
		turnId: request.turnId,
		attemptId: request.attemptId,
	});
};

describe("voice workbench projections", () => {
	it("derives the exact 19-command blueprint independently for fresh components", async () => {
		const first = createFixture();
		const second = createFixture();
		makeAvailable(first.actor);
		await first.component.execute({
			command: "changeDraft",
			input: "first only",
		});

		expect(Object.keys(first.component.getSchema().commands).sort()).toEqual(
			commandNames,
		);
		expect(Object.keys(second.component.getSchema().commands).sort()).toEqual(
			commandNames,
		);
		expect(first.component.getStates()).toMatchObject({
			status: "ready",
			commandCount: 19,
			presentation: { draft: "first only" },
		});
		expect(second.component.getStates()).toMatchObject({
			status: "preparing",
			commandCount: 19,
			presentation: { draft: "" },
		});
	});

	it("projects the same command availability used by canExecute in every workflow phase", () => {
		const { actor, component } = createFixture();
		expectProjectedCommandAvailability(component);

		makeAvailable(actor);
		expectProjectedCommandAvailability(component);

		actor.send({
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: "Create a checklist" },
		});
		actor.send({
			type: "CREATE_ARTIFACT",
			input: {
				id: "shopping-list",
				nodes: [
					{
						id: "items",
						kind: "checklist",
						items: [{ id: "milk", label: "Milk", checked: false }],
					},
				],
			},
		});
		expectProjectedCommandAvailability(component);

		cancelActiveTurn(actor);
		expectProjectedCommandAvailability(component);
	});

	it("projects normalized and revision-correlated command inputs before rendering", async () => {
		const { actor, component } = createFixture();
		makeAvailable(actor);

		actor.send({
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: "Create a checklist" },
		});
		actor.send({
			type: "CREATE_ARTIFACT",
			input: {
				id: "shopping-list",
				title: "Shopping list",
				nodes: [
					{
						id: "items",
						kind: "checklist",
						items: [{ id: "milk", label: "Milk", checked: false }],
					},
				],
			},
		});
		cancelActiveTurn(actor);

		const firstRevision = actor.getSnapshot().context.documents[0]?.revision;
		if (!firstRevision)
			throw new Error("Expected the first artifact revision.");
		actor.send({
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: "Revise the checklist" },
		});
		actor.send({
			type: "REVISE_ARTIFACT",
			input: {
				artifactId: "shopping-list",
				expectedRevision: firstRevision,
				nodes: [
					{
						id: "items",
						kind: "checklist",
						items: [{ id: "milk", label: "Milk", checked: true }],
					},
				],
			},
		});
		cancelActiveTurn(actor);

		await component.execute({
			command: "changeDraft",
			input: "  Send this exactly once  ",
		});
		const currentRevision = actor.getSnapshot().context.documents[0]?.revision;
		if (!currentRevision) throw new Error("Expected the current revision.");

		const view = component.getStates();
		expect(view).toMatchObject({
			intents: {
				submitPrompt: {
					modality: "text",
					text: "Send this exactly once",
				},
			},
			artifactSummaries: [
				{
					id: "shopping-list",
					selectInput: { artifactId: "shopping-list" },
				},
			],
			activeArtifact: {
				id: "shopping-list",
				nodes: [
					{
						id: "items",
						items: [
							{
								id: "milk",
								setCheckedInput: {
									artifactId: "shopping-list",
									expectedRevision: currentRevision,
									nodeId: "items",
									itemId: "milk",
									checked: false,
								},
							},
						],
					},
				],
			},
		});
		expect(view.activeArtifactRevisions).toEqual(
			expect.arrayContaining([
				{
					current: false,
					key: `shopping-list:${firstRevision}`,
					label: `Revision ${firstRevision}`,
					nodeCount: 1,
					restoreInput: {
						artifactId: "shopping-list",
						expectedRevision: currentRevision,
						revision: firstRevision,
					},
					restoreLabel: `Restore revision ${firstRevision}`,
					revision: firstRevision,
					summary: "1 node",
					title: "Shopping list",
				},
			]),
		);

		await component.execute({ command: "changeDraft", input: "   " });
		expect(component.getStates()).toMatchObject({
			intents: { submitPrompt: null },
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
		expect(componentSource).toContain(
			"selectVoiceWorkbenchCommandAvailability",
		);
		expect(
			componentSource.match(
				/selectVoiceWorkbenchCommandAvailability\(snapshot\)/g,
			),
		).toHaveLength(11);
		expect(componentSource).not.toContain("snapshot.matches(");
		expect(viewSource).toContain('snapshot.matches("preparing")');
		expect(viewSource).toContain("commandCount: blueprintRows.length");
		expect(viewSource).toContain("actorMatchText");
		expect(conversationSource).not.toContain(".trim(");
		expect(conversationSource).toContain("context.intents.submitPrompt");
		expect(artifactSource).not.toContain("expectedRevision");
		expect(artifactSource).toContain("item.setCheckedInput");
		expect(artifactSource).toContain("artifact.selectInput");
		expect(artifactSource).toContain("revision.restoreInput");
		expect(workbenchSource).toContain("context.commandCount");
	});
});
