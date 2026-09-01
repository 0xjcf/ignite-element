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
	selectVoiceWorkbenchCommandAvailability,
	type WorkbenchBlueprintCommands,
} from "./workbench-view";

export const createVoiceWorkbenchComponent = (
	actor: VoiceWorkbenchSessionActor,
) => {
	let blueprintCommands: WorkbenchBlueprintCommands = {};
	const component = igniteCore({
		source: actor,
		cleanup: true,
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
		commands: ({ actor, command }) => {
			const responsePayloadInput = command.object(
				{
					text: command.string({ minLength: 1 }),
					speech: command.string({ minLength: 1 }),
				},
				{ required: ["text"] },
			);
			const actionNodeInput = command.object(
				{
					kind: command.enum(["action"]),
					id: command.string({ minLength: 1 }),
					label: command.string({ minLength: 1 }),
					commandName: command.enum(["completeResponse"]),
					payload: responsePayloadInput,
					description: command.string({ minLength: 1 }),
				},
				{
					required: ["kind", "id", "label", "commandName", "payload"],
				},
			);
			const semanticNodeInput = command.object(
				{
					id: command.string({ minLength: 1 }),
					kind: command.enum([
						"text",
						"checklist",
						"action",
						"form",
						"table",
						"timeline",
						"chart",
						"code-diff",
						"decision-log",
					]),
					text: command.string({ minLength: 1 }),
					items: command.array(
						command.object(
							{
								id: command.string({ minLength: 1 }),
								label: command.string({ minLength: 1 }),
								checked: command.boolean(),
							},
							{ required: ["id", "label", "checked"] },
						),
						{ minItems: 1 },
					),
					label: command.string({ minLength: 1 }),
					commandName: command.enum(["completeResponse"]),
					payload: responsePayloadInput,
					description: command.string({ minLength: 1 }),
					title: command.string({ minLength: 1 }),
					fields: command.array(
						command.object(
							{
								id: command.string({ minLength: 1 }),
								label: command.string({ minLength: 1 }),
								input: command.object(
									{
										type: command.enum(["string", "number", "boolean"]),
										title: command.string({ minLength: 1 }),
										description: command.string({ minLength: 1 }),
										minimum: command.number(),
										maximum: command.number(),
										minLength: command.number({ minimum: 0 }),
										maxLength: command.number({ minimum: 0 }),
									},
									{ required: ["type"] },
								),
								value: command.string(),
								description: command.string({ minLength: 1 }),
							},
							{ required: ["id", "label", "input"] },
						),
					),
					submit: actionNodeInput,
					columns: command.array(
						command.object(
							{
								id: command.string({ minLength: 1 }),
								label: command.string({ minLength: 1 }),
							},
							{ required: ["id", "label"] },
						),
					),
					rows: command.array(
						command.object(
							{
								id: command.string({ minLength: 1 }),
								cells: command.array(),
							},
							{ required: ["id", "cells"] },
						),
					),
					events: command.array(
						command.object(
							{
								id: command.string({ minLength: 1 }),
								label: command.string({ minLength: 1 }),
								timestamp: command.string({ minLength: 1 }),
								detail: command.string({ minLength: 1 }),
							},
							{ required: ["id", "label", "timestamp"] },
						),
					),
					chartType: command.enum(["bar", "line", "pie"]),
					series: command.array(
						command.object(
							{
								id: command.string({ minLength: 1 }),
								label: command.string({ minLength: 1 }),
								value: command.number(),
							},
							{ required: ["id", "label", "value"] },
						),
					),
					language: command.string({ minLength: 1 }),
					before: command.string({ minLength: 1 }),
					after: command.string({ minLength: 1 }),
					entries: command.array(
						command.object(
							{
								id: command.string({ minLength: 1 }),
								title: command.string({ minLength: 1 }),
								decision: command.string({ minLength: 1 }),
								rationale: command.string({ minLength: 1 }),
							},
							{ required: ["id", "title", "decision"] },
						),
					),
				},
				{ required: ["id", "kind"] },
			);
			const sendPresentationUpdate = (
				envelope: WorkbenchPresentationEnvelope,
			) => actor.send({ type: "PRESENTATION_UPDATED", envelope });

			return {
				acknowledgeSpeech: command(
					(input: AcknowledgeSpeechInput) =>
						actor.send({ type: "ACKNOWLEDGE_SPEECH", input }),
					{
						channel: "user-intent",
						description: "Acknowledge the currently pending speech request.",
						canExecute: ({ snapshot }) =>
							selectVoiceWorkbenchCommandAvailability(snapshot)
								.acknowledgeSpeech,
						input: command.object(
							{ id: command.string({ minLength: 1 }) },
							{ required: ["id"] },
						),
					},
				),
				beginModelPreparation: command(
					() => actor.send({ type: "MODEL_PREPARATION_STARTED" }),
					{ channel: "user-intent" },
				),
				cancelVoiceCapture: command(
					() => actor.send({ type: "VOICE_CAPTURE_CANCEL_REQUESTED" }),
					{
						channel: "user-intent",
						canExecute: ({ snapshot }) =>
							selectVoiceWorkbenchCommandAvailability(snapshot)
								.cancelVoiceCapture,
					},
				),
				changeArtifactView: command(
					(view: WorkbenchArtifactView) =>
						sendPresentationUpdate({
							channel: "user-intent",
							update: { type: "artifact-view-changed", view },
						}),
					{ channel: "user-intent" },
				),
				changeDraft: command(
					(draft: string) =>
						sendPresentationUpdate({
							channel: "user-intent",
							update: { type: "draft-changed", draft },
						}),
					{ channel: "user-intent" },
				),
				changeMobilePanel: command(
					(panel: WorkbenchPanel) =>
						sendPresentationUpdate({
							channel: "user-intent",
							update: { type: "mobile-panel-changed", panel },
						}),
					{ channel: "user-intent" },
				),
				changeSpeechPreference: command(
					(enabled: boolean) =>
						sendPresentationUpdate({
							channel: "user-intent",
							update: { type: "speech-preference-changed", enabled },
						}),
					{ channel: "user-intent" },
				),
				completeResponse: command(
					(input: CompleteResponseInput) =>
						actor.send({ type: "COMPLETE_RESPONSE", input }),
					{
						channel: "model-intent",
						description: "Complete the active response turn.",
						canExecute: ({ snapshot }) =>
							selectVoiceWorkbenchCommandAvailability(snapshot)
								.completeResponse,
						input: command.object(
							{
								text: command.string({ minLength: 1 }),
								speech: command.string({ minLength: 1 }),
							},
							{ required: ["text"] },
						),
					},
				),
				createArtifact: command(
					(input: CreateArtifactInput) =>
						actor.send({ type: "CREATE_ARTIFACT", input }),
					{
						channel: "model-intent",
						description:
							"Create a validated semantic artifact for the active turn.",
						canExecute: ({ snapshot }) =>
							selectVoiceWorkbenchCommandAvailability(snapshot).createArtifact,
						input: command.object(
							{
								id: command.string({ minLength: 1 }),
								title: command.string({ minLength: 1 }),
								nodes: command.array(semanticNodeInput, { minItems: 1 }),
							},
							{ required: ["id", "nodes"] },
						),
					},
				),
				playSpeech: command(
					() => actor.send({ type: "SPEECH_DELIVERY_REPLAY_REQUESTED" }),
					{ channel: "user-intent" },
				),
				replay: command(
					() =>
						sendPresentationUpdate({
							channel: "user-intent",
							update: { type: "replayed" },
						}),
					{ channel: "user-intent" },
				),
				selectRuntimePreview: command(
					(preview: WorkbenchRuntimePreview) =>
						sendPresentationUpdate({
							channel: "user-intent",
							update: { type: "runtime-preview-selected", preview },
						}),
					{ channel: "user-intent" },
				),
				reviseArtifact: command(
					(input: ReviseArtifactInput) =>
						actor.send({ type: "REVISE_ARTIFACT", input }),
					{
						channel: "model-intent",
						description:
							"Revise an artifact when its expected revision still matches.",
						canExecute: ({ snapshot }) =>
							selectVoiceWorkbenchCommandAvailability(snapshot).reviseArtifact,
						input: command.object(
							{
								artifactId: command.string({ minLength: 1 }),
								expectedRevision: command.string({ minLength: 1 }),
								nodes: command.array(semanticNodeInput, { minItems: 1 }),
							},
							{ required: ["artifactId", "expectedRevision", "nodes"] },
						),
					},
				),
				restoreArtifactRevision: command(
					(input: RestoreArtifactRevisionInput) =>
						actor.send({ type: "RESTORE_ARTIFACT_REVISION", input }),
					{
						channel: "user-intent",
						description:
							"Restore a historical snapshot as a new forward artifact revision.",
						canExecute: ({ snapshot }) =>
							selectVoiceWorkbenchCommandAvailability(snapshot)
								.restoreArtifactRevision,
						input: command.object(
							{
								artifactId: command.string({ minLength: 1 }),
								expectedRevision: command.string({ minLength: 1 }),
								revision: command.string({ minLength: 1 }),
							},
							{
								required: ["artifactId", "expectedRevision", "revision"],
							},
						),
					},
				),
				selectArtifact: command(
					(input: SelectArtifactInput) =>
						actor.send({ type: "SELECT_ARTIFACT", input }),
					{
						channel: "user-intent",
						description: "Select the active artifact in this session.",
						canExecute: ({ snapshot }) =>
							selectVoiceWorkbenchCommandAvailability(snapshot).selectArtifact,
						input: command.object(
							{ artifactId: command.string({ minLength: 1 }) },
							{ required: ["artifactId"] },
						),
					},
				),
				setChecklistItem: command(
					(input: SetChecklistItemInput) =>
						actor.send({ type: "SET_CHECKLIST_ITEM", input }),
					{
						channel: "model-intent",
						description:
							"Set one checklist item when its artifact revision still matches.",
						canExecute: ({ snapshot }) =>
							selectVoiceWorkbenchCommandAvailability(snapshot)
								.setChecklistItem,
						input: command.object(
							{
								artifactId: command.string({ minLength: 1 }),
								expectedRevision: command.string({ minLength: 1 }),
								nodeId: command.string({ minLength: 1 }),
								itemId: command.string({ minLength: 1 }),
								checked: command.boolean(),
							},
							{
								required: [
									"artifactId",
									"expectedRevision",
									"nodeId",
									"itemId",
									"checked",
								],
							},
						),
					},
				),
				submitPrompt: command(
					(input: SubmitPromptInput) =>
						actor.send({ type: "SUBMIT_PROMPT", input }),
					{
						channel: "user-intent",
						description: "Open the next text or speech conversation turn.",
						canExecute: ({ snapshot }) =>
							selectVoiceWorkbenchCommandAvailability(snapshot).submitPrompt,
						input: command.object(
							{
								modality: command.enum(["text", "speech"]),
								text: command.string({ minLength: 1 }),
							},
							{ required: ["modality", "text"] },
						),
					},
				),
				startVoiceCapture: command(
					() => actor.send({ type: "VOICE_CAPTURE_START_REQUESTED" }),
					{
						channel: "user-intent",
						canExecute: ({ snapshot }) =>
							selectVoiceWorkbenchCommandAvailability(snapshot)
								.startVoiceCapture,
					},
				),
				submitVoiceTranscript: command(
					() => actor.send({ type: "VOICE_TRANSCRIPT_SUBMIT_REQUESTED" }),
					{
						channel: "user-intent",
						canExecute: ({ snapshot }) =>
							selectVoiceWorkbenchCommandAvailability(snapshot)
								.submitVoiceTranscript,
					},
				),
			};
		},
		effects: ({ emit, select }) => {
			const fact = select((snapshot) => snapshot.context.lastFact);
			const sequence = select((snapshot) => snapshot.context.factSequence);
			if (!sequence.changed || !fact.current) return;
			emit(fact.current as ConversationFact);
		},
	});
	blueprintCommands = component.getSchema().commands;
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
export type WorkbenchView = ReturnType<VoiceWorkbenchComponent["getStates"]>;
