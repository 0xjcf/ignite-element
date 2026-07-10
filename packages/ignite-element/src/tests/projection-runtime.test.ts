// @vitest-environment node
import { assign, setup } from "xstate";
import { describe, expect, it, vi } from "vitest";
import { igniteCore } from "../xstate";
import {
	applyProjectionDocumentPatch,
	parseProjectionDocument,
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
							documents: ({ context, event }) => {
								const nextDocuments: ProjectionDocument[] = [];
								for (const document of context.documents) {
									if (document.id !== event.patch.documentId) {
										nextDocuments.push(document);
										continue;
									}

									const result = applyProjectionDocumentPatch(
										document,
										event.patch,
									);
									nextDocuments.push(result.ok ? result.document : document);
								}
								return nextDocuments;
							},
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
		const unsafeDocument = parseProjectionDocument({
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
		});
		const unsafeCaseDocument = parseProjectionDocument({
			id: "unsafe-case",
			revision: "1",
			nodes: [
				{
					kind: "text",
					id: "unsafe-case-text",
					text: "Unsafe",
					JSX: "<button />",
				},
			],
		});
		if (!unsafeDocument.ok || !unsafeCaseDocument.ok) {
			throw new Error("Expected unsafe documents to parse structurally.");
		}

		expect(
			validateProjectionDocument(unsafeDocument.document, {
				schema: core.getSchema(),
				canExecute: core.canExecute,
			}),
		).toContain("nodes[0].jsx: executable content is not allowed");
		expect(
			validateProjectionDocument(unsafeCaseDocument.document, {
				schema: core.getSchema(),
				canExecute: core.canExecute,
			}),
		).toContain("nodes[0].JSX: executable content is not allowed");

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

		expect(
			validateProjectionDocument(
				{
					id: "missing-labels",
					revision: "1",
					nodes: [
						{
							kind: "checklist",
							id: "list",
							items: [{ id: "", label: "", checked: false }],
						},
					],
				},
				{
					schema: core.getSchema(),
					canExecute: core.canExecute,
				},
			),
		).toEqual(
			expect.arrayContaining([
				"nodes[0].items[0].id: required",
				"nodes[0].items[0].label: required",
			]),
		);
	});

	it("parses unknown input without throwing and rejects malformed documents", () => {
		expect(parseProjectionDocument(null)).toEqual({
			ok: false,
			issues: ["document: expected object"],
		});

		expect(
			parseProjectionDocument({
				id: "panel",
				revision: "1",
				nodes: null,
			}),
		).toEqual({
			ok: false,
			issues: ["nodes: expected array"],
		});

		expect(
			parseProjectionDocument({
				id: "panel",
				revision: "1",
				nodes: [null],
			}),
		).toEqual({
			ok: false,
			issues: ["nodes[0]: expected object"],
		});

		expect(
			parseProjectionDocument({
				id: "panel",
				revision: "1",
				nodes: [
					{
						kind: "checklist",
						id: "items",
						items: {},
					},
				],
			}),
		).toEqual({
			ok: false,
			issues: ["nodes[0].items: expected array"],
		});
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
			baseRevision: "1",
			revision: "2",
			type: "set-node",
			node: {
				kind: "text",
				id: "summary",
				text: "After",
			},
		};

		expect(applyProjectionDocumentPatch(original, patch)).toEqual({
			ok: true,
			document: {
				id: "panel",
				revision: "2",
				nodes: [
					{
						kind: "text",
						id: "summary",
						text: "After",
					},
				],
			},
		});
	});

	it("rejects stale and mismatched patch preconditions as facts instead of throwing", () => {
		const original: ProjectionDocument = {
			id: "panel",
			revision: "2",
			nodes: [{ kind: "text", id: "summary", text: "Current" }],
		};

		expect(
			applyProjectionDocumentPatch(original, {
				documentId: "panel",
				baseRevision: "1",
				revision: "3",
				type: "set-node",
				node: { kind: "text", id: "summary", text: "Stale" },
			}),
		).toEqual({
			ok: false,
			code: "stale-revision",
			reason:
				'Projection patch base revision "1" does not match current revision "2".',
		});

		expect(
			applyProjectionDocumentPatch(original, {
				documentId: "other-panel",
				baseRevision: "2",
				revision: "3",
				type: "remove-node",
				nodeId: "summary",
			}),
		).toEqual({
			ok: false,
			code: "document-mismatch",
			reason:
				'Projection patch target "other-panel" does not match document "panel".',
		});

		expect(
			applyProjectionDocumentPatch(original, {
				documentId: "panel",
				baseRevision: "2",
				revision: "2",
				type: "remove-node",
				nodeId: "summary",
			}),
		).toEqual({
			ok: false,
			code: "stale-revision",
			reason:
				'Projection patch revision "2" must advance beyond base revision "2".',
		});
	});
});

describe("projection targets", () => {
	const flushMicrotasks = () =>
		new Promise<void>((resolve) => queueMicrotask(resolve));

	it("binds a branded document target, commits revision changes, and disposes cleanly", async () => {
		const core = createProjectionCore();
		const commits: string[] = [];
		const target = createProjectionDocumentTarget({
			commitDocument: (document) => {
				commits.push(document.revision);
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
			baseRevision: "1",
			revision: "2",
			type: "set-node",
			node: { kind: "text", id: "summary", text: "Updated" },
		});

		expect(commits).toEqual(["1", "2"]);

		session.dispose();

		await core.execute("patchProjection", {
			documentId: "panel",
			baseRevision: "2",
			revision: "3",
			type: "set-node",
			node: { kind: "text", id: "summary", text: "Disposed" },
		});

		expect(commits).toEqual(["1", "2"]);
	});

	it("speaks request-driven utterances once and acknowledges them through commands", async () => {
		const core = createProjectionCore();
		const speak = vi.fn();
		const target = createProjectionSpeechTarget({
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

	it("does not duplicate slow document commits when overlapping snapshots arrive", async () => {
		const core = createProjectionCore();
		const pendingCommit: { current: (() => void) | null } = { current: null };
		const commitDocument = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					pendingCommit.current = resolve;
				}),
		);
		const session = core(
			createProjectionDocumentTarget({
				commitDocument,
			}),
		);

		await core.execute("upsertProjection", {
			id: "panel",
			revision: "1",
			nodes: [{ kind: "text", id: "summary", text: "Ready" }],
		});
		await flushMicrotasks();
		await core.execute("queueSpeech", {
			id: "speech-1",
			text: "System ready.",
			status: "pending",
		});
		await flushMicrotasks();

		expect(commitDocument).toHaveBeenCalledTimes(1);

		const releaseDocumentCommit = pendingCommit.current;
		if (typeof releaseDocumentCommit === "function") {
			releaseDocumentCommit();
		}
		await flushMicrotasks();
		session.dispose();
	});

	it("does not duplicate slow speech commits when unrelated snapshots arrive", async () => {
		const core = createProjectionCore();
		const pendingCommit: { current: (() => void) | null } = { current: null };
		const commitSpeech = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					pendingCommit.current = resolve;
				}),
		);
		const session = core(
			createProjectionSpeechTarget({
				commitSpeech,
				acknowledgeCommandName: "acknowledgeSpeech",
				resolveAcknowledgePayload: (speech) => ({ speechId: speech.id }),
			}),
		);

		await core.execute("queueSpeech", {
			id: "speech-1",
			text: "System ready.",
			status: "pending",
		});
		await flushMicrotasks();
		await core.execute("upsertProjection", {
			id: "panel",
			revision: "1",
			nodes: [{ kind: "text", id: "summary", text: "Ready" }],
		});
		await flushMicrotasks();

		expect(commitSpeech).toHaveBeenCalledTimes(1);

		const releaseSpeechCommit = pendingCommit.current;
		if (typeof releaseSpeechCommit === "function") {
			releaseSpeechCommit();
		}
		await flushMicrotasks();
		session.dispose();
	});

	it("does not surface invalid projection documents as unhandled rejections", async () => {
		const core = createProjectionCore();
		const commitDocument = vi.fn();
		const session = core(
			createProjectionDocumentTarget({
				commitDocument,
			}),
		);
		const unhandled: unknown[] = [];
		const captureUnhandled = (reason: unknown) => {
			unhandled.push(reason);
		};

		process.on("unhandledRejection", captureUnhandled);

		try {
			await core.execute("upsertProjection", {
				id: "panel",
				revision: "1",
				nodes: [
					{
						kind: "action",
						id: "confirm",
						label: "Confirm",
						commandName: "missing",
					},
				],
			});
			await flushMicrotasks();
		} finally {
			process.off("unhandledRejection", captureUnhandled);
			session.dispose();
		}

		expect(commitDocument).not.toHaveBeenCalled();
		expect(unhandled).toEqual([]);
	});

	it("does not throw or reject when malformed raw projection data enters state", async () => {
		const malformedMachine = setup({
			types: {
				context: {} as {
					documents: unknown[];
					speech: unknown;
				},
				events: {} as
					| { type: "SET_DOCUMENTS"; documents: unknown[] }
					| { type: "SET_SPEECH"; speech: unknown },
			},
		}).createMachine({
			context: {
				documents: [],
				speech: null,
			},
			initial: "active",
			states: {
				active: {
					on: {
						SET_DOCUMENTS: {
							actions: assign({
								documents: ({ event }) => event.documents,
							}),
						},
						SET_SPEECH: {
							actions: assign({
								speech: ({ event }) => event.speech,
							}),
						},
					},
				},
			},
		});
		const core = igniteCore({
			source: malformedMachine,
			view: () => ({}),
			commands: ({ actor, command }) => ({
				setDocuments: command(
					(documents: unknown[]) =>
						actor.send({ type: "SET_DOCUMENTS", documents }),
					{ input: command.array() },
				),
				setSpeech: command(
					(speech: unknown) => actor.send({ type: "SET_SPEECH", speech }),
					{ input: command.object() },
				),
			}),
		});
		const commitDocument = vi.fn();
		const commitSpeech = vi.fn();
		const sessionA = core(
			createProjectionDocumentTarget({
				commitDocument,
			}),
		);
		const sessionB = core(
			createProjectionSpeechTarget({
				commitSpeech,
				acknowledgeCommandName: "setSpeech",
			}),
		);
		const unhandled: unknown[] = [];
		const captureUnhandled = (reason: unknown) => {
			unhandled.push(reason);
		};

		process.on("unhandledRejection", captureUnhandled);
		try {
			await core.execute("setDocuments", [null, { id: "broken" }]);
			await core.execute("setSpeech", { id: 1, text: null, status: "pending" });
			await flushMicrotasks();
		} finally {
			process.off("unhandledRejection", captureUnhandled);
			sessionA.dispose();
			sessionB.dispose();
		}

		expect(commitDocument).not.toHaveBeenCalled();
		expect(commitSpeech).not.toHaveBeenCalled();
		expect(unhandled).toEqual([]);
	});
});
