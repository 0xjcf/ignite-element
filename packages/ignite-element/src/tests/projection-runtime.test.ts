// @vitest-environment node
import { assign, setup } from "xstate";
import { describe, expect, it, vi } from "vitest";
import { igniteCore } from "../xstate";
import {
	applyProjectionDocumentPatch,
	upsertProjectionDocument,
	validateProjectionDocument,
} from "../internal/projectionDocument";
import {
	createProjectionDocumentTarget,
	createProjectionSpeechTarget,
	type ProjectionDocument,
	type ProjectionDocumentPatch,
	type ProjectionSpeechRequest,
} from "../index";

type ProjectionContext = {
	documents: ProjectionDocument[];
	speech: ProjectionSpeechRequest | null;
	allowConfirm: boolean;
};

type ProjectionEvent =
	| { type: "UPSERT_PROJECTION"; document: ProjectionDocument }
	| { type: "PATCH_PROJECTION"; patch: ProjectionDocumentPatch }
	| { type: "QUEUE_SPEECH"; speech: ProjectionSpeechRequest }
	| { type: "ACKNOWLEDGE_SPEECH"; speechId: string }
	| { type: "TOGGLE_ALLOW_CONFIRM"; value: boolean }
	| { type: "CONFIRM"; payload: { value: number } };

function createProjectionCore() {
	const machine = setup({
		types: {
			context: {} as ProjectionContext,
			events: {} as ProjectionEvent,
		},
	}).createMachine({
		id: "projection-runtime",
		context: {
			documents: [],
			speech: null,
			allowConfirm: true,
		},
		initial: "active",
		states: {
			active: {
				on: {
					UPSERT_PROJECTION: {
						actions: assign({
							documents: ({ context, event }) =>
								upsertProjectionDocument(context.documents, event.document),
						}),
					},
					PATCH_PROJECTION: {
						actions: assign({
							documents: ({ context, event }) =>
								context.documents.map((document) =>
									document.id === event.patch.documentId
										? applyProjectionDocumentPatch(document, event.patch)
										: document,
								),
						}),
					},
					QUEUE_SPEECH: {
						actions: assign({
							speech: ({ event }) => event.speech,
						}),
					},
					ACKNOWLEDGE_SPEECH: {
						actions: assign({
							speech: ({ context, event }) =>
								context.speech?.id === event.speechId
									? {
											...context.speech,
											status: "acknowledged",
										}
									: context.speech,
						}),
					},
					TOGGLE_ALLOW_CONFIRM: {
						actions: assign({
							allowConfirm: ({ event }) => event.value,
						}),
					},
					CONFIRM: {
						actions: () => undefined,
					},
				},
			},
		},
	});

	return igniteCore({
		source: machine,
		view: ({ snapshot }) => ({
			documentCount: snapshot.context.documents.length,
			speechStatus: snapshot.context.speech?.status ?? "idle",
		}),
		commands: ({ actor, command }) => ({
			upsertProjection: command(
				(document: ProjectionDocument) =>
					actor.send({ type: "UPSERT_PROJECTION", document }),
				{
					description: "Create or replace a projection document.",
					input: command.object(),
				},
			),
			patchProjection: command(
				(patch: ProjectionDocumentPatch) =>
					actor.send({ type: "PATCH_PROJECTION", patch }),
				{
					description: "Patch an existing projection document.",
					input: command.object(),
				},
			),
			queueSpeech: command(
				(speech: ProjectionSpeechRequest) =>
					actor.send({ type: "QUEUE_SPEECH", speech }),
				{
					description: "Queue a speech request.",
					input: command.object(),
				},
			),
			acknowledgeSpeech: command(
				(payload: { speechId: string }) =>
					actor.send({
						type: "ACKNOWLEDGE_SPEECH",
						speechId: payload.speechId,
					}),
				{
					description: "Acknowledge a spoken utterance.",
					input: command.object({
						speechId: command.string(),
					}),
				},
			),
			confirm: command(
				(payload: { value: number }) =>
					actor.send({ type: "CONFIRM", payload }),
				{
					description: "Confirm the proposed value.",
					input: command.object({
						value: command.number({ minimum: 1 }),
					}),
					canExecute: ({ snapshot }) => snapshot.context.allowConfirm,
				},
			),
		}),
	});
}

describe("projection document helpers", () => {
	it("validates safe semantic documents and command-backed actions", () => {
		const document: ProjectionDocument = {
			id: "panel",
			revision: "1",
			nodes: [
				{
					kind: "text",
					id: "summary",
					text: "Ready to confirm",
				},
				{
					kind: "action",
					id: "confirm",
					label: "Confirm",
					commandName: "confirm",
					payload: { value: 2 },
				},
			],
		};
		const core = createProjectionCore();

		expect(
			validateProjectionDocument(document, {
				schema: core.getSchema(),
				canExecute: core.canExecute,
			}),
		).toEqual([]);
	});

	it("rejects executable content, missing commands, and invalid payloads", () => {
		const core = createProjectionCore();
		const unsafeDocument = {
			id: "unsafe",
			revision: "1",
			nodes: [
				{
					kind: "text",
					id: "unsafe-text",
					text: "Unsafe",
					jsx: "<button />",
				},
			],
		};

		expect(
			validateProjectionDocument(unsafeDocument as ProjectionDocument, {
				schema: core.getSchema(),
				canExecute: core.canExecute,
			}),
		).toContain("nodes[0].jsx: executable content is not allowed");

		expect(
			validateProjectionDocument(
				{
					id: "missing-command",
					revision: "1",
					nodes: [
						{
							kind: "action",
							id: "ghost",
							label: "Ghost",
							commandName: "missing",
						},
					],
				},
				{
					schema: core.getSchema(),
					canExecute: core.canExecute,
				},
			),
		).toContain('nodes[0].commandName: unknown command "missing"');

		expect(
			validateProjectionDocument(
				{
					id: "invalid-payload",
					revision: "1",
					nodes: [
						{
							kind: "action",
							id: "confirm",
							label: "Confirm",
							commandName: "confirm",
							payload: { value: 0 },
						},
					],
				},
				{
					schema: core.getSchema(),
					canExecute: core.canExecute,
				},
			),
		).toContain("nodes[0].payload.value: below minimum 1");
	});

	it("applies revision-aware document patches by stable node id", () => {
		const original: ProjectionDocument = {
			id: "panel",
			revision: "1",
			nodes: [
				{
					kind: "text",
					id: "summary",
					text: "Before",
				},
			],
		};
		const patch: ProjectionDocumentPatch = {
			documentId: "panel",
			revision: "2",
			type: "set-node",
			node: {
				kind: "text",
				id: "summary",
				text: "After",
			},
		};

		expect(applyProjectionDocumentPatch(original, patch)).toEqual({
			id: "panel",
			revision: "2",
			nodes: [
				{
					kind: "text",
					id: "summary",
					text: "After",
				},
			],
		});
	});
});

describe("projection targets", () => {
	it("binds a branded document target, commits revision changes, and disposes cleanly", async () => {
		const core = createProjectionCore();
		type ProjectionSnapshot = ReturnType<typeof core.getSnapshot>;
		type ProjectionView = ReturnType<typeof core.getView>;
		const commits: string[] = [];
		const target = createProjectionDocumentTarget<
			ProjectionSnapshot,
			ReturnType<typeof core.getSchema>["snapshot"],
			ProjectionView
		>({
			selectDocument: ({ snapshot }) => snapshot.context.documents[0] ?? null,
			commitDocument: (document, inspection) => {
				commits.push(`${document.revision}:${inspection.view.documentCount}`);
			},
		});
		const session = core(target);

		await core.execute("upsertProjection", {
			id: "panel",
			revision: "1",
			nodes: [{ kind: "text", id: "summary", text: "Ready" }],
		});
		await core.execute("patchProjection", {
			documentId: "panel",
			revision: "2",
			type: "set-node",
			node: { kind: "text", id: "summary", text: "Updated" },
		});

		expect(commits).toEqual(["1:1", "2:1"]);

		session.dispose();

		await core.execute("patchProjection", {
			documentId: "panel",
			revision: "3",
			type: "set-node",
			node: { kind: "text", id: "summary", text: "Disposed" },
		});

		expect(commits).toEqual(["1:1", "2:1"]);
	});

	it("speaks request-driven utterances once and acknowledges them through commands", async () => {
		const core = createProjectionCore();
		type ProjectionSnapshot = ReturnType<typeof core.getSnapshot>;
		type ProjectionView = ReturnType<typeof core.getView>;
		const speak = vi.fn();
		const target = createProjectionSpeechTarget<
			ProjectionSnapshot,
			ReturnType<typeof core.getSchema>["snapshot"],
			ProjectionView
		>({
			selectSpeech: ({ snapshot }) => snapshot.context.speech,
			commitSpeech: (speech) => {
				speak(speech.id, speech.text);
			},
			acknowledgeCommandName: "acknowledgeSpeech",
			resolveAcknowledgePayload: (speech) => ({ speechId: speech.id }),
		});
		const session = core(target);

		await core.execute("queueSpeech", {
			id: "speech-1",
			text: "System ready.",
			status: "pending",
		});
		await core.execute("upsertProjection", {
			id: "panel",
			revision: "1",
			nodes: [{ kind: "text", id: "summary", text: "Ready" }],
		});

		expect(speak).toHaveBeenCalledTimes(1);
		expect(speak).toHaveBeenNthCalledWith(1, "speech-1", "System ready.");
		expect(core.getSnapshot().context.speech?.status).toBe("acknowledged");

		session.dispose();
		const reboundSession = core(target);

		expect(speak).toHaveBeenCalledTimes(1);

		await core.execute("queueSpeech", {
			id: "speech-2",
			text: "Updated.",
			status: "pending",
		});

		expect(speak).toHaveBeenCalledTimes(2);
		expect(speak).toHaveBeenNthCalledWith(2, "speech-2", "Updated.");
		reboundSession.dispose();
	});
});
