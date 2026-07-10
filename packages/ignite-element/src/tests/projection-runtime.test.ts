// @vitest-environment node
import { command, type IgniteAdapter, StateScope } from "@ignite-element/core";
import { assign, setup } from "xstate";
import { describe, expect, it, vi } from "vitest";
import { igniteCore } from "../xstate";
import { createIgniteComponentFactory } from "../igniteCore/createIgniteComponentFactory";
import {
	applyProjectionDocumentPatch,
	parseProjectionDocument,
	upsertProjectionDocument,
	validateProjectionDocument,
} from "../internal/projectionDocument";
import {
	createProjectionDocumentTarget,
	createProjectionSpeechTarget,
} from "../index";
import type {
	ProjectionDocument,
	ProjectionDocumentPatch,
	ProjectionSpeechRequest,
} from "../types/agent";

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

type InspectionSnapshot = {
	context: {
		documents: ProjectionDocument[];
		speech: ProjectionSpeechRequest | null;
		allowConfirm: boolean;
	};
};

type InspectionEvent = { type: "NOOP" };

type InspectionView = {
	documents: ProjectionDocument[];
	speech: ProjectionSpeechRequest | null;
};

function createInspectionCore(
	getSnapshot: () => InspectionSnapshot,
	resolveView: (snapshot: InspectionSnapshot) => InspectionView,
	onCanExecute: (snapshot: InspectionSnapshot) => void = () => undefined,
) {
	const adapter: IgniteAdapter<InspectionSnapshot, InspectionEvent> = {
		scope: StateScope.Isolated,
		subscribeSnapshots: () => ({ unsubscribe: () => undefined }),
		send: () => undefined,
		getSnapshot: vi.fn(getSnapshot),
		stop: vi.fn(),
	};
	const createAdapter = Object.assign(() => adapter, {
		scope: StateScope.Isolated,
		resolveStateSnapshot: (
			current: IgniteAdapter<InspectionSnapshot, InspectionEvent>,
		) => current.getSnapshot(),
	});
	const core = createIgniteComponentFactory(createAdapter, {
		view: ({ snapshot }) => resolveView(snapshot),
		commands: ({ command: createCommand }) => ({
			acknowledgeSpeech: () => undefined,
			confirm: createCommand((_payload: { value: number }) => undefined, {
				input: command.object({ value: command.number() }),
				canExecute: ({ snapshot }) => {
					onCanExecute(snapshot);
					return snapshot.context.allowConfirm;
				},
			}),
		}),
	});

	return { adapter, core };
}

function createRawProjectionCore() {
	type RawProjectionSnapshot = { documents: unknown[] };
	type RawProjectionEvent = {
		type: "SET_DOCUMENTS";
		documents: unknown[];
	};
	let snapshot: RawProjectionSnapshot = { documents: [] };
	const listeners = new Set<(state: RawProjectionSnapshot) => void>();
	const adapter: IgniteAdapter<RawProjectionSnapshot, RawProjectionEvent> = {
		scope: StateScope.Isolated,
		subscribeSnapshots: (listener) => {
			listeners.add(listener);
			return { unsubscribe: () => listeners.delete(listener) };
		},
		send: (event) => {
			snapshot = { documents: event.documents };
			for (const listener of listeners) {
				listener(snapshot);
			}
		},
		getSnapshot: () => snapshot,
		stop: vi.fn(),
	};
	const createAdapter = Object.assign(() => adapter, {
		scope: StateScope.Isolated,
		resolveStateSnapshot: (
			current: IgniteAdapter<RawProjectionSnapshot, RawProjectionEvent>,
		) => current.getSnapshot(),
	});
	const core = createIgniteComponentFactory(createAdapter, {
		view: () => ({}),
		commands: () => ({}),
	});

	return {
		core,
		setDocuments: (documents: unknown[]) =>
			adapter.send({ type: "SET_DOCUMENTS", documents }),
	};
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

	it("rejects exact unsafe keys inside canonical schema payloads", () => {
		const core = createProjectionCore();
		const unsafeKeys = [
			"onClick",
			"ONCLICK",
			"onInput",
			"ONINPUT",
			"domRef",
			"DOMREF",
			"jsx",
			"JSX",
		];

		for (const unsafeKey of unsafeKeys) {
			const parsed = parseProjectionDocument({
				id: `unsafe-${unsafeKey}`,
				revision: "1",
				nodes: [
					{
						kind: "action",
						id: "unsafe-action",
						label: "Unsafe",
						commandName: "confirm",
						payload: {
							value: 2,
							[unsafeKey]: "executable",
						},
					},
				],
			});

			expect(parsed.ok).toBe(true);
			if (parsed.ok) {
				expect(
					validateProjectionDocument(parsed.document, {
						schema: core.getSchema(),
						canExecute: core.canExecute,
					}),
				).toContain(
					`nodes[0].payload.${unsafeKey}: executable content is not allowed`,
				);
			} else {
				expect(parsed.issues).toEqual([]);
			}
		}
	});

	it("rejects arbitrary event-handler-shaped keys recursively", () => {
		const core = createProjectionCore();
		const unsafeKeys = ["onMouseOver", "onerror", "ONLOAD", "onPointerDown"];

		for (const unsafeKey of unsafeKeys) {
			const parse = () =>
				parseProjectionDocument({
					id: `unsafe-${unsafeKey}`,
					revision: "1",
					nodes: [
						{
							kind: "action",
							id: "unsafe-action",
							label: "Unsafe",
							commandName: "confirm",
							payload: {
								value: 2,
								[unsafeKey]: "executable",
							},
						},
					],
				});

			expect(parse).not.toThrow();
			const parsed = parse();
			expect(parsed.ok).toBe(true);
			if (parsed.ok) {
				expect(
					validateProjectionDocument(parsed.document, {
						schema: core.getSchema(),
						canExecute: core.canExecute,
					}),
				).toContain(
					`nodes[0].payload.${unsafeKey}: executable content is not allowed`,
				);
			} else {
				expect(parsed.issues).toEqual([]);
			}
		}
	});

	it("canonicalizes every semantic node through explicit field allowlists", () => {
		const parsed = parseProjectionDocument({
			id: "catalog",
			revision: "1",
			title: "Semantic catalog",
			innerHTML: "<script>topLevel()</script>",
			nodes: [
				{
					kind: "text",
					id: "text",
					text: "Ready",
					metadata: { dangerouslySetInnerHTML: { __html: "unsafe" } },
				},
				{
					kind: "checklist",
					id: "checklist",
					items: [
						{
							id: "checked",
							label: "Checked",
							checked: true,
							srcdoc: "<script>nested()</script>",
						},
					],
				},
				{
					kind: "action",
					id: "confirm",
					label: "Confirm",
					commandName: "confirm",
					payload: { value: 2 },
					description: "Confirm the value",
					href: "javascript:confirm()",
				},
				{
					kind: "form",
					id: "form",
					title: "Profile",
					fields: [
						{
							id: "name",
							label: "Name",
							input: { type: "string", minLength: 1 },
							value: "Ada",
							description: "Display name",
							innerHTML: "<script>field()</script>",
						},
					],
					submit: {
						kind: "action",
						id: "save",
						label: "Save",
						commandName: "confirm",
						payload: { value: 3 },
						description: "Save profile",
						dangerouslySetInnerHTML: { __html: "unsafe" },
					},
				},
				{
					kind: "table",
					id: "table",
					columns: [{ id: "name", label: "Name", srcdoc: "unsafe" }],
					rows: [
						{
							id: "row",
							cells: ["Ada", { active: true }],
							innerHTML: "unsafe",
						},
					],
				},
				{
					kind: "timeline",
					id: "timeline",
					events: [
						{
							id: "created",
							label: "Created",
							timestamp: "2026-07-10T00:00:00Z",
							detail: "Created safely",
							href: "javascript:timeline()",
						},
					],
				},
				{
					kind: "chart",
					id: "chart",
					chartType: "bar",
					series: [
						{
							id: "value",
							label: "Value",
							value: 4,
							srcdoc: "unsafe",
						},
					],
				},
				{
					kind: "code-diff",
					id: "diff",
					language: "ts",
					before: "const before = true;",
					after: "const after = true;",
					dangerouslySetInnerHTML: { __html: "unsafe" },
				},
				{
					kind: "decision-log",
					id: "decisions",
					entries: [
						{
							id: "decision",
							title: "Use data",
							decision: "Canonicalize input",
							rationale: "Keep committers safe",
							innerHTML: "unsafe",
						},
					],
				},
			],
		});

		expect(parsed).toEqual({
			ok: true,
			document: {
				id: "catalog",
				revision: "1",
				title: "Semantic catalog",
				nodes: [
					{ kind: "text", id: "text", text: "Ready" },
					{
						kind: "checklist",
						id: "checklist",
						items: [{ id: "checked", label: "Checked", checked: true }],
					},
					{
						kind: "action",
						id: "confirm",
						label: "Confirm",
						commandName: "confirm",
						payload: { value: 2 },
						description: "Confirm the value",
					},
					{
						kind: "form",
						id: "form",
						title: "Profile",
						fields: [
							{
								id: "name",
								label: "Name",
								input: { type: "string", minLength: 1 },
								value: "Ada",
								description: "Display name",
							},
						],
						submit: {
							kind: "action",
							id: "save",
							label: "Save",
							commandName: "confirm",
							payload: { value: 3 },
							description: "Save profile",
						},
					},
					{
						kind: "table",
						id: "table",
						columns: [{ id: "name", label: "Name" }],
						rows: [{ id: "row", cells: ["Ada", { active: true }] }],
					},
					{
						kind: "timeline",
						id: "timeline",
						events: [
							{
								id: "created",
								label: "Created",
								timestamp: "2026-07-10T00:00:00Z",
								detail: "Created safely",
							},
						],
					},
					{
						kind: "chart",
						id: "chart",
						chartType: "bar",
						series: [{ id: "value", label: "Value", value: 4 }],
					},
					{
						kind: "code-diff",
						id: "diff",
						language: "ts",
						before: "const before = true;",
						after: "const after = true;",
					},
					{
						kind: "decision-log",
						id: "decisions",
						entries: [
							{
								id: "decision",
								title: "Use data",
								decision: "Canonicalize input",
								rationale: "Keep committers safe",
							},
						],
					},
				],
			},
		});
	});

	it("rejects accessor-bearing projection data without invoking getters", () => {
		const getter = vi.fn(() => {
			throw new Error("getter executed");
		});
		const node = {
			kind: "text",
			id: "summary",
			text: "Ready",
		};
		Object.defineProperty(node, "metadata", {
			enumerable: true,
			get: getter,
		});

		const parsed = parseProjectionDocument({
			id: "panel",
			revision: "1",
			nodes: [node],
		});

		expect(getter).not.toHaveBeenCalled();
		expect(parsed).toEqual({
			ok: false,
			issues: ["nodes[0].metadata: accessor properties are not allowed"],
		});
		const topLevelGetter = vi.fn(() => {
			throw new Error("top-level getter executed");
		});
		const topLevelDocument = { id: "panel", revision: "1" };
		Object.defineProperty(topLevelDocument, "nodes", {
			enumerable: true,
			get: topLevelGetter,
		});
		expect(parseProjectionDocument(topLevelDocument)).toEqual({
			ok: false,
			issues: ["nodes: accessor properties are not allowed"],
		});
		expect(topLevelGetter).not.toHaveBeenCalled();
		expect(
			parseProjectionDocument({
				id: "panel",
				revision: "1",
				nodes: [
					{
						kind: "text",
						id: "summary",
						text: "Ready",
						metadata: new Map([["unsafe", "value"]]),
					},
				],
			}),
		).toEqual({
			ok: false,
			issues: ["nodes[0].metadata: expected plain data object"],
		});
	});

	it("rejects missing commands and invalid payloads", () => {
		const core = createProjectionCore();

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

	it("prefers actor-owned snapshot context over conflicting derived view output", async () => {
		const actorDocument: ProjectionDocument = {
			id: "panel",
			revision: "actor-1",
			nodes: [{ kind: "text", id: "actor", text: "Actor owned" }],
		};
		const viewDocument: ProjectionDocument = {
			id: "panel",
			revision: "view-1",
			nodes: [{ kind: "text", id: "view", text: "Derived view" }],
		};
		const actorSpeech: ProjectionSpeechRequest = {
			id: "actor-speech",
			text: "Actor owned speech",
			status: "pending",
		};
		const viewSpeech: ProjectionSpeechRequest = {
			id: "view-speech",
			text: "Derived view speech",
			status: "pending",
		};
		const snapshot: InspectionSnapshot = {
			context: {
				documents: [actorDocument],
				speech: actorSpeech,
				allowConfirm: true,
			},
		};
		const { core } = createInspectionCore(
			() => snapshot,
			() => ({
				documents: [viewDocument],
				speech: viewSpeech,
			}),
		);
		const commitDocument = vi.fn();
		const commitSpeech = vi.fn();
		const documentSession = core(
			createProjectionDocumentTarget({ commitDocument }),
		);
		const speechSession = core(
			createProjectionSpeechTarget({
				commitSpeech,
				acknowledgeCommandName: "acknowledgeSpeech",
			}),
		);

		await flushMicrotasks();
		await flushMicrotasks();

		expect(commitDocument).toHaveBeenCalledWith(actorDocument);
		expect(commitSpeech).toHaveBeenCalledWith(actorSpeech);

		documentSession.dispose();
		speechSession.dispose();
	});

	it("keeps actor-owned empty projection channels authoritative", async () => {
		const viewDocument: ProjectionDocument = {
			id: "panel",
			revision: "view-1",
			nodes: [{ kind: "text", id: "view", text: "Derived view" }],
		};
		const viewSpeech: ProjectionSpeechRequest = {
			id: "view-speech",
			text: "Derived view speech",
			status: "pending",
		};
		const snapshot: InspectionSnapshot = {
			context: {
				documents: [],
				speech: null,
				allowConfirm: true,
			},
		};
		const { core } = createInspectionCore(
			() => snapshot,
			() => ({
				documents: [viewDocument],
				speech: viewSpeech,
			}),
		);
		const commitDocument = vi.fn();
		const commitSpeech = vi.fn();
		const documentSession = core(
			createProjectionDocumentTarget({ commitDocument }),
		);
		const speechSession = core(
			createProjectionSpeechTarget({
				commitSpeech,
				acknowledgeCommandName: "acknowledgeSpeech",
			}),
		);

		await flushMicrotasks();
		await flushMicrotasks();

		expect(commitDocument).not.toHaveBeenCalled();
		expect(commitSpeech).not.toHaveBeenCalled();

		documentSession.dispose();
		speechSession.dispose();
	});

	it("uses one captured snapshot for document validation and command availability", async () => {
		let reads = 0;
		const availabilitySnapshots: InspectionSnapshot[] = [];
		const { adapter, core } = createInspectionCore(
			() => {
				reads += 1;
				return {
					context: {
						documents: [
							{
								id: "panel",
								revision: String(reads),
								nodes: [
									{
										kind: "action",
										id: "confirm",
										label: "Confirm",
										commandName: "confirm",
										payload: { value: 1 },
									},
								],
							},
						],
						speech: null,
						allowConfirm: true,
					},
				};
			},
			() => ({ documents: [], speech: null }),
			(snapshot) => availabilitySnapshots.push(snapshot),
		);
		const commitDocument = vi.fn<(document: ProjectionDocument) => void>();
		const session = core(createProjectionDocumentTarget({ commitDocument }));

		await flushMicrotasks();
		await flushMicrotasks();

		expect(adapter.getSnapshot).toHaveBeenCalledTimes(5);
		expect(commitDocument).toHaveBeenCalledTimes(1);
		expect(availabilitySnapshots).toHaveLength(1);
		expect(availabilitySnapshots[0]?.context.documents[0]?.revision).toBe(
			commitDocument.mock.calls[0]?.[0].revision,
		);

		session.dispose();
	});

	it("removes executable fields before committing raw projection data", async () => {
		const { core, setDocuments } = createRawProjectionCore();
		const commitDocument = vi.fn<(document: ProjectionDocument) => void>();
		const session = core(createProjectionDocumentTarget({ commitDocument }));

		setDocuments([
			{
				id: "panel",
				revision: "1",
				dangerouslySetInnerHTML: { __html: "<script>topLevel()</script>" },
				innerHTML: "<script>topLevel()</script>",
				srcdoc: "<script>topLevel()</script>",
				href: "javascript:topLevel()",
				nodes: [
					{
						kind: "text",
						id: "summary",
						text: "Ready",
						metadata: {
							dangerouslySetInnerHTML: {
								__html: "<img src=x onerror=nested()>",
							},
							innerHTML: "<script>nested()</script>",
							srcdoc: "<script>nested()</script>",
							href: "javascript:nested()",
						},
					},
				],
			},
		]);
		await flushMicrotasks();
		await flushMicrotasks();

		expect(commitDocument).toHaveBeenCalledTimes(1);
		expect(commitDocument).toHaveBeenCalledWith({
			id: "panel",
			revision: "1",
			nodes: [{ kind: "text", id: "summary", text: "Ready" }],
		});

		session.dispose();
	});

	it("fails closed on raw accessor data without an unhandled rejection", async () => {
		const { core, setDocuments } = createRawProjectionCore();
		const commitDocument = vi.fn();
		const session = core(createProjectionDocumentTarget({ commitDocument }));
		const getter = vi.fn(() => {
			throw new Error("getter executed");
		});
		const node = {
			kind: "text",
			id: "summary",
			text: "Ready",
		};
		Object.defineProperty(node, "metadata", {
			enumerable: true,
			get: getter,
		});
		const unhandled: unknown[] = [];
		const captureUnhandled = (reason: unknown) => {
			unhandled.push(reason);
		};

		process.on("unhandledRejection", captureUnhandled);
		try {
			setDocuments([
				{
					id: "panel",
					revision: "1",
					nodes: [node],
				},
			]);
			await flushMicrotasks();
			await flushMicrotasks();
		} finally {
			process.off("unhandledRejection", captureUnhandled);
			session.dispose();
		}

		expect(getter).not.toHaveBeenCalled();
		expect(commitDocument).not.toHaveBeenCalled();
		expect(unhandled).toEqual([]);
	});

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

	it("rejects invalid one-argument overload inputs instead of returning a no-op session", () => {
		const core = createProjectionCore();

		expect(() => core("div" as never)).toThrow(
			"[igniteElementFactory] The one-argument overload only accepts first-party projection targets.",
		);
		expect(() => core({ kind: "document" } as never)).toThrow(
			"[igniteElementFactory] The one-argument overload only accepts first-party projection targets.",
		);
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
