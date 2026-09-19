import { igniteCore } from "ignite-element/xstate";
import type {
	AcknowledgeSpeechInput,
	CompleteResponseInput,
	ConversationFact,
	CreateArtifactInput,
	RestoreArtifactRevisionInput,
	ReviseArtifactInput,
	SelectArtifactInput,
	SetChecklistItemInput,
	SubmitPromptInput,
} from "./domain";
import type {
	VoiceWorkbenchSessionActor,
	WorkbenchArtifactView,
	WorkbenchPanel,
	WorkbenchPresentationEnvelope,
	WorkbenchRuntimePreview,
} from "./session";
import {
	projectVoiceWorkbenchView,
	type WorkbenchBlueprintCommands,
} from "./workbench-view";

export const createVoiceWorkbenchComponent = (
	actor: VoiceWorkbenchSessionActor,
) => {
	const blueprintCommands: WorkbenchBlueprintCommands =
		voiceWorkbenchCommandDefinitions;
	const component = igniteCore({
		source: actor,
		events: (event) => ({
			"prompt-submitted": event<{
				turnId: string;
				modality: "text" | "speech";
				text: string;
			}>(),
			"artifact-created": event<{ artifactId: string; revision: string }>(),
			"artifact-revised": event<{ artifactId: string; revision: string }>(),
			"artifact-restored": event<{
				artifactId: string;
				fromRevision: string;
				revision: string;
			}>(),
			"artifact-selected": event<{ artifactId: string }>(),
			"artifact-rejected": event<{
				reason: "validation" | "conflict";
				issues?: readonly string[];
			}>(),
			"response-completed": event(),
			"speech-acknowledged": event<{ id: string }>(),
		}),
		states: (snapshot) =>
			projectVoiceWorkbenchView({ snapshot, blueprintCommands }),
		commands: ({ source: actor }) => {
			const sendPresentationUpdate = (
				envelope: WorkbenchPresentationEnvelope,
			) => actor.send({ type: "PRESENTATION_UPDATED", envelope });

			return {
				acknowledgeSpeech: (input: AcknowledgeSpeechInput) =>
					actor.send({ type: "ACKNOWLEDGE_SPEECH", input }),
				beginModelPreparation: () =>
					actor.send({ type: "MODEL_PREPARATION_STARTED" }),
				cancelVoiceCapture: () =>
					actor.send({ type: "VOICE_CAPTURE_CANCEL_REQUESTED" }),
				changeArtifactView: (view: WorkbenchArtifactView) =>
					sendPresentationUpdate({
						channel: "user-intent",
						update: { type: "artifact-view-changed", view },
					}),
				changeDraft: (draft: string) =>
					sendPresentationUpdate({
						channel: "user-intent",
						update: { type: "draft-changed", draft },
					}),
				changeMobilePanel: (panel: WorkbenchPanel) =>
					sendPresentationUpdate({
						channel: "user-intent",
						update: { type: "mobile-panel-changed", panel },
					}),
				changeSpeechPreference: (enabled: boolean) =>
					sendPresentationUpdate({
						channel: "user-intent",
						update: { type: "speech-preference-changed", enabled },
					}),
				completeResponse: (input: CompleteResponseInput) =>
					actor.send({ type: "COMPLETE_RESPONSE", input }),
				createArtifact: (input: CreateArtifactInput) =>
					actor.send({ type: "CREATE_ARTIFACT", input }),
				playSpeech: () =>
					actor.send({ type: "SPEECH_DELIVERY_REPLAY_REQUESTED" }),
				replay: () =>
					sendPresentationUpdate({
						channel: "user-intent",
						update: { type: "replayed" },
					}),
				selectRuntimePreview: (preview: WorkbenchRuntimePreview) =>
					sendPresentationUpdate({
						channel: "user-intent",
						update: { type: "runtime-preview-selected", preview },
					}),
				reviseArtifact: (input: ReviseArtifactInput) =>
					actor.send({ type: "REVISE_ARTIFACT", input }),
				restoreArtifactRevision: (input: RestoreArtifactRevisionInput) =>
					actor.send({ type: "RESTORE_ARTIFACT_REVISION", input }),
				selectArtifact: (input: SelectArtifactInput) =>
					actor.send({ type: "SELECT_ARTIFACT", input }),
				setChecklistItem: (input: SetChecklistItemInput) =>
					actor.send({ type: "SET_CHECKLIST_ITEM", input }),
				submitPrompt: (input: SubmitPromptInput) =>
					actor.send({ type: "SUBMIT_PROMPT", input }),
				startVoiceCapture: () =>
					actor.send({ type: "VOICE_CAPTURE_START_REQUESTED" }),
				submitVoiceTranscript: () =>
					actor.send({ type: "VOICE_TRANSCRIPT_SUBMIT_REQUESTED" }),
			};
		},
		effects: ({ emit, select }) => {
			const fact = select((snapshot) => snapshot.context.lastFact);
			const sequence = select((snapshot) => snapshot.context.factSequence);
			if (!sequence.changed || !fact.current) return;
			emit(fact.current as ConversationFact);
		},
	});
	return component;
};

export type VoiceWorkbenchComponent = ReturnType<
	typeof createVoiceWorkbenchComponent
>;

type WorkbenchRenderer = Extract<
	Parameters<VoiceWorkbenchComponent>[1],
	(...args: never[]) => unknown
>;
export type WorkbenchProjection = Parameters<WorkbenchRenderer>[0];
export type WorkbenchView = ReturnType<typeof projectVoiceWorkbenchView>;

const responsePayloadInput = {
	type: "object",
	properties: {
		text: { type: "string", ...{ minLength: 1 } },
		speech: { type: "string", ...{ minLength: 1 } },
	},
	...{ required: ["text"] },
};
const actionNodeInput = {
	type: "object",
	properties: {
		kind: { type: "string", enum: [...["action"]], ...{} },
		id: { type: "string", ...{ minLength: 1 } },
		label: { type: "string", ...{ minLength: 1 } },
		commandName: { type: "string", enum: [...["completeResponse"]], ...{} },
		payload: responsePayloadInput,
		description: { type: "string", ...{ minLength: 1 } },
	},
	...{ required: ["kind", "id", "label", "commandName", "payload"] },
};
const semanticNodeInput = {
	type: "object",
	properties: {
		id: { type: "string", ...{ minLength: 1 } },
		kind: {
			type: "string",
			enum: [
				...[
					"text",
					"checklist",
					"action",
					"form",
					"table",
					"timeline",
					"chart",
					"code-diff",
					"decision-log",
				],
			],
			...{},
		},
		text: { type: "string", ...{ minLength: 1 } },
		items: {
			type: "array",
			items: {
				type: "object",
				properties: {
					id: { type: "string", ...{ minLength: 1 } },
					label: { type: "string", ...{ minLength: 1 } },
					checked: { type: "boolean", ...{} },
				},
				...{ required: ["id", "label", "checked"] },
			},
			...{ minItems: 1 },
		},
		label: { type: "string", ...{ minLength: 1 } },
		commandName: { type: "string", enum: [...["completeResponse"]], ...{} },
		payload: responsePayloadInput,
		description: { type: "string", ...{ minLength: 1 } },
		title: { type: "string", ...{ minLength: 1 } },
		fields: {
			type: "array",
			items: {
				type: "object",
				properties: {
					id: { type: "string", ...{ minLength: 1 } },
					label: { type: "string", ...{ minLength: 1 } },
					input: {
						type: "object",
						properties: {
							type: {
								type: "string",
								enum: [...["string", "number", "boolean"]],
								...{},
							},
							title: { type: "string", ...{ minLength: 1 } },
							description: { type: "string", ...{ minLength: 1 } },
							minimum: { type: "number", ...{} },
							maximum: { type: "number", ...{} },
							minLength: { type: "number", ...{ minimum: 0 } },
							maxLength: { type: "number", ...{ minimum: 0 } },
						},
						...{ required: ["type"] },
					},
					value: { type: "string", ...{} },
					description: { type: "string", ...{ minLength: 1 } },
				},
				...{ required: ["id", "label", "input"] },
			},
			...{},
		},
		submit: actionNodeInput,
		columns: {
			type: "array",
			items: {
				type: "object",
				properties: {
					id: { type: "string", ...{ minLength: 1 } },
					label: { type: "string", ...{ minLength: 1 } },
				},
				...{ required: ["id", "label"] },
			},
			...{},
		},
		rows: {
			type: "array",
			items: {
				type: "object",
				properties: {
					id: { type: "string", ...{ minLength: 1 } },
					cells: { type: "array", ...{} },
				},
				...{ required: ["id", "cells"] },
			},
			...{},
		},
		events: {
			type: "array",
			items: {
				type: "object",
				properties: {
					id: { type: "string", ...{ minLength: 1 } },
					label: { type: "string", ...{ minLength: 1 } },
					timestamp: { type: "string", ...{ minLength: 1 } },
					detail: { type: "string", ...{ minLength: 1 } },
				},
				...{ required: ["id", "label", "timestamp"] },
			},
			...{},
		},
		chartType: { type: "string", enum: [...["bar", "line", "pie"]], ...{} },
		series: {
			type: "array",
			items: {
				type: "object",
				properties: {
					id: { type: "string", ...{ minLength: 1 } },
					label: { type: "string", ...{ minLength: 1 } },
					value: { type: "number", ...{} },
				},
				...{ required: ["id", "label", "value"] },
			},
			...{},
		},
		language: { type: "string", ...{ minLength: 1 } },
		before: { type: "string", ...{ minLength: 1 } },
		after: { type: "string", ...{ minLength: 1 } },
		entries: {
			type: "array",
			items: {
				type: "object",
				properties: {
					id: { type: "string", ...{ minLength: 1 } },
					title: { type: "string", ...{ minLength: 1 } },
					decision: { type: "string", ...{ minLength: 1 } },
					rationale: { type: "string", ...{ minLength: 1 } },
				},
				...{ required: ["id", "title", "decision"] },
			},
			...{},
		},
	},
	...{ required: ["id", "kind"] },
};
export const voiceWorkbenchCommandDefinitions = {
	acknowledgeSpeech: {
		channel: "user-intent",
		description: "Acknowledge the currently pending speech request.",
		gated: true,
		input: {
			type: "object",
			properties: { id: { type: "string", ...{ minLength: 1 } } },
			...{ required: ["id"] },
		},
	},
	beginModelPreparation: { channel: "user-intent" },
	cancelVoiceCapture: { channel: "user-intent", gated: true },
	changeArtifactView: { channel: "user-intent" },
	changeDraft: { channel: "user-intent" },
	changeMobilePanel: { channel: "user-intent" },
	changeSpeechPreference: { channel: "user-intent" },
	completeResponse: {
		channel: "model-intent",
		description: "Complete the active response turn.",
		gated: true,
		input: {
			type: "object",
			properties: {
				text: { type: "string", ...{ minLength: 1 } },
				speech: { type: "string", ...{ minLength: 1 } },
			},
			...{ required: ["text"] },
		},
	},
	createArtifact: {
		channel: "model-intent",
		description: "Create a validated semantic artifact for the active turn.",
		gated: true,
		input: {
			type: "object",
			properties: {
				id: { type: "string", ...{ minLength: 1 } },
				title: { type: "string", ...{ minLength: 1 } },
				nodes: { type: "array", items: semanticNodeInput, ...{ minItems: 1 } },
			},
			...{ required: ["id", "nodes"] },
		},
	},
	playSpeech: { channel: "user-intent" },
	replay: { channel: "user-intent" },
	selectRuntimePreview: { channel: "user-intent" },
	reviseArtifact: {
		channel: "model-intent",
		description: "Revise an artifact when its expected revision still matches.",
		gated: true,
		input: {
			type: "object",
			properties: {
				artifactId: { type: "string", ...{ minLength: 1 } },
				expectedRevision: { type: "string", ...{ minLength: 1 } },
				nodes: { type: "array", items: semanticNodeInput, ...{ minItems: 1 } },
			},
			...{ required: ["artifactId", "expectedRevision", "nodes"] },
		},
	},
	restoreArtifactRevision: {
		channel: "user-intent",
		description:
			"Restore a historical snapshot as a new forward artifact revision.",
		gated: true,
		input: {
			type: "object",
			properties: {
				artifactId: { type: "string", ...{ minLength: 1 } },
				expectedRevision: { type: "string", ...{ minLength: 1 } },
				revision: { type: "string", ...{ minLength: 1 } },
			},
			...{ required: ["artifactId", "expectedRevision", "revision"] },
		},
	},
	selectArtifact: {
		channel: "user-intent",
		description: "Select the active artifact in this session.",
		gated: true,
		input: {
			type: "object",
			properties: { artifactId: { type: "string", ...{ minLength: 1 } } },
			...{ required: ["artifactId"] },
		},
	},
	setChecklistItem: {
		channel: "model-intent",
		description:
			"Set one checklist item when its artifact revision still matches.",
		gated: true,
		input: {
			type: "object",
			properties: {
				artifactId: { type: "string", ...{ minLength: 1 } },
				expectedRevision: { type: "string", ...{ minLength: 1 } },
				nodeId: { type: "string", ...{ minLength: 1 } },
				itemId: { type: "string", ...{ minLength: 1 } },
				checked: { type: "boolean", ...{} },
			},
			...{
				required: [
					"artifactId",
					"expectedRevision",
					"nodeId",
					"itemId",
					"checked",
				],
			},
		},
	},
	submitPrompt: {
		channel: "user-intent",
		description: "Open the next text or speech conversation turn.",
		gated: true,
		input: {
			type: "object",
			properties: {
				modality: { type: "string", enum: [...["text", "speech"]], ...{} },
				text: { type: "string", ...{ minLength: 1 } },
			},
			...{ required: ["modality", "text"] },
		},
	},
	startVoiceCapture: { channel: "user-intent", gated: true },
	submitVoiceTranscript: { channel: "user-intent", gated: true },
};

// The model receives only these already-defined application capabilities.
// User-intent functions with unknown input schemas are not automatic tools.
export const voiceWorkbenchModelSchema = {
	commands: {
		createArtifact: voiceWorkbenchCommandDefinitions.createArtifact,
		reviseArtifact: voiceWorkbenchCommandDefinitions.reviseArtifact,
		setChecklistItem: voiceWorkbenchCommandDefinitions.setChecklistItem,
		completeResponse: voiceWorkbenchCommandDefinitions.completeResponse,
	},
};
