// @vitest-environment node
import { command, type IgniteAdapter, StateScope } from "@ignite-element/core";
import { describe, expect, it, vi } from "vitest";
import { assign, createActor, createMachine, setup } from "xstate";
import "../internal/setupDomPolyfill";
import { createComponentFactory } from "../createComponentFactory";
import { createIgniteComponentFactory } from "../igniteCore/createIgniteComponentFactory";
import {
	createProjectionDocumentTarget,
	createProjectionSpeechTarget,
} from "../index";
import {
	applyProjectionDocumentPatch,
	parseProjectionDocument,
	parseProjectionDocumentCollection,
	upsertProjectionDocument,
	validateProjectionDocument,
} from "../internal/projectionDocument";
import { createAgentRuntime } from "../runtime/agent";
import type {
	ProjectionDocument,
	ProjectionDocumentPatch,
	ProjectionSpeechRequest,
} from "../types/agent";
import type { IgniteSchemaValue } from "../types/schema";
import { igniteCore } from "../xstate";

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

function createRawProjectionCore(
	resolveView: () => Record<string, unknown> = () => ({}),
) {
	type RawProjectionEvent = {
		type: "SET_SNAPSHOT";
		snapshot: unknown;
	};
	let snapshot: unknown = { documents: [], speech: null };
	const listeners = new Set<(state: unknown) => void>();
	const adapter: IgniteAdapter<unknown, RawProjectionEvent> = {
		scope: StateScope.Isolated,
		subscribeSnapshots: (listener) => {
			listeners.add(listener);
			return { unsubscribe: () => listeners.delete(listener) };
		},
		send: (event) => {
			snapshot = event.snapshot;
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
			current: IgniteAdapter<unknown, RawProjectionEvent>,
		) => current.getSnapshot(),
	});
	const core = createIgniteComponentFactory(createAdapter, {
		view: resolveView,
		commands: () => ({ acknowledgeSpeech: () => undefined }),
	});

	return {
		core,
		setDocuments: (documents: unknown) =>
			adapter.send({
				type: "SET_SNAPSHOT",
				snapshot: { documents, speech: null },
			}),
		setSpeech: (speech: unknown) =>
			adapter.send({
				type: "SET_SNAPSHOT",
				snapshot: { documents: [], speech },
			}),
		setSnapshot: (nextSnapshot: unknown) =>
			adapter.send({ type: "SET_SNAPSHOT", snapshot: nextSnapshot }),
	};
}

type ProjectionJsonIsland =
	| "action-payload"
	| "submit-payload"
	| "form-input"
	| "form-value"
	| "table-cell";

function createJsonIslandDocument(
	island: ProjectionJsonIsland,
	businessValue: IgniteSchemaValue,
	id: string,
): ProjectionDocument {
	const nestedValue = { business: [{ value: businessValue }] };
	switch (island) {
		case "action-payload":
			return {
				id,
				revision: "1",
				nodes: [
					{
						kind: "action",
						id: "confirm",
						label: "Confirm",
						commandName: "confirm",
						payload: { value: 2, nestedValue },
					},
				],
			};
		case "submit-payload":
			return {
				id,
				revision: "1",
				nodes: [
					{
						kind: "form",
						id: "form",
						fields: [
							{
								id: "name",
								label: "Name",
								input: { type: "string" },
							},
						],
						submit: {
							kind: "action",
							id: "submit",
							label: "Submit",
							commandName: "confirm",
							payload: { value: 2, nestedValue },
						},
					},
				],
			};
		case "form-input":
			return {
				id,
				revision: "1",
				nodes: [
					{
						kind: "form",
						id: "form",
						fields: [
							{
								id: "name",
								label: "Name",
								input: { type: "string", nestedValue },
							},
						],
					},
				],
			};
		case "form-value":
			return {
				id,
				revision: "1",
				nodes: [
					{
						kind: "form",
						id: "form",
						fields: [
							{
								id: "name",
								label: "Name",
								input: { type: "string" },
								value: nestedValue,
							},
						],
					},
				],
			};
		case "table-cell":
			return {
				id,
				revision: "1",
				nodes: [
					{
						kind: "table",
						id: "table",
						columns: [{ id: "value", label: "Value" }],
						rows: [{ id: "row", cells: [nestedValue] }],
					},
				],
			};
	}
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

	it("rejects actual DOM event-handler attribute keys recursively", () => {
		const core = createProjectionCore();
		const unsafeKeys = [
			"onMouseOver",
			"onerror",
			"ONLOAD",
			"onPointerDown",
			"onKeyDown",
			"onSubmit",
			"onTouchStart",
			"onAnimationEnd",
			"onTransitionEnd",
			"onBeforeInput",
		];

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

	it("preserves benign on-prefixed vocabulary recursively in every JSON island", () => {
		const core = createProjectionCore();
		const benignValue: IgniteSchemaValue = {
			online: {
				only: [
					{
						once: true,
						onboarding: "complete",
					},
				],
			},
		};
		const islands: ProjectionJsonIsland[] = [
			"action-payload",
			"submit-payload",
			"form-input",
			"form-value",
			"table-cell",
		];

		for (const island of islands) {
			const parsed = parseProjectionDocument(
				createJsonIslandDocument(island, benignValue, `benign-${island}`),
			);
			expect(parsed.ok).toBe(true);
			if (parsed.ok) {
				expect(
					validateProjectionDocument(parsed.document, {
						schema: core.getSchema(),
						canExecute: core.canExecute,
					}),
				).toEqual([]);
			}
		}
	});

	it("rejects real handler attributes recursively in every JSON island", () => {
		const core = createProjectionCore();
		const islands: ProjectionJsonIsland[] = [
			"action-payload",
			"submit-payload",
			"form-input",
			"form-value",
			"table-cell",
		];
		const handlerKeys = [
			"onClick",
			"onInput",
			"onMouseOver",
			"onerror",
			"ONLOAD",
			"onPointerDown",
			"onKeyDown",
			"onSubmit",
			"onTouchStart",
			"onAnimationEnd",
			"onTransitionEnd",
			"onBeforeInput",
			"onreadystatechange",
			"ONREADYSTATECHANGE",
			"onvisibilitychange",
			"ONVISIBILITYCHANGE",
			"onwebkitanimationend",
			"ONWEBKITANIMATIONEND",
			"onwebkittransitionend",
			"ONWEBKITTRANSITIONEND",
			"onFuturePlatformEvent",
			"ONFUTUREPLATFORMEVENT",
		];

		for (const island of islands) {
			for (const handlerKey of handlerKeys) {
				const parsed = parseProjectionDocument(
					createJsonIslandDocument(
						island,
						{ nested: { [handlerKey]: "unsafe" } },
						`handler-${island}-${handlerKey}`,
					),
				);
				expect(parsed.ok).toBe(true);
				if (parsed.ok) {
					const issues = validateProjectionDocument(parsed.document, {
						schema: core.getSchema(),
						canExecute: core.canExecute,
					});
					expect(
						issues.some((issue) =>
							issue.endsWith(
								`.nested.${handlerKey}: executable content is not allowed`,
							),
						),
					).toBe(true);
				}
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

	it("rejects inherited command names through the unknown-command path", () => {
		const core = createProjectionCore();
		const inheritedCommands = Object.create({
			constructor: {},
			toString: {},
		});
		const schema = {
			...core.getSchema(),
			commands: inheritedCommands,
		};
		const canExecute = vi.fn(() => true);

		for (const commandName of ["toString", "constructor"]) {
			expect(
				validateProjectionDocument(
					{
						id: `inherited-${commandName}`,
						revision: "1",
						nodes: [
							{
								kind: "action",
								id: "inherited-action",
								label: "Inherited",
								commandName,
							},
						],
					},
					{ schema, canExecute },
				),
			).toContain(`nodes[0].commandName: unknown command "${commandName}"`);
		}

		expect(canExecute).not.toHaveBeenCalled();
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

	it("accumulates document field and nodes shape issues", () => {
		expect(
			parseProjectionDocument({
				id: "",
				revision: null,
				title: "",
				nodes: null,
			}),
		).toEqual({
			ok: false,
			issues: [
				"id: required",
				"revision: required",
				"title: required",
				"nodes: expected array",
			],
		});
	});

	it("rejects duplicate document ids as an all-or-nothing collection", () => {
		expect(
			parseProjectionDocumentCollection([
				{
					id: "panel",
					revision: "1",
					nodes: [{ kind: "text", id: "first", text: "First" }],
				},
				{
					id: "other",
					revision: "1",
					nodes: [{ kind: "text", id: "other", text: "Other" }],
				},
				{
					id: "panel",
					revision: "2",
					nodes: [{ kind: "text", id: "duplicate", text: "Duplicate" }],
				},
			]),
		).toEqual({
			ok: false,
			issues: ['documents[2].id: duplicate document id "panel"'],
		});
	});

	it("preserves catalog and node order when replacing stable ids", () => {
		const first: ProjectionDocument = {
			id: "first",
			revision: "1",
			nodes: [{ kind: "text", id: "first-node", text: "First" }],
		};
		const middle: ProjectionDocument = {
			id: "middle",
			revision: "1",
			nodes: [{ kind: "text", id: "middle-node", text: "Middle" }],
		};
		const last: ProjectionDocument = {
			id: "last",
			revision: "1",
			nodes: [{ kind: "text", id: "last-node", text: "Last" }],
		};
		const documents = [first, middle, last];
		const replacement: ProjectionDocument = {
			...middle,
			revision: "2",
		};

		const replacedDocuments = upsertProjectionDocument(documents, replacement);
		expect(replacedDocuments.map((document) => document.id)).toEqual([
			"first",
			"middle",
			"last",
		]);
		expect(replacedDocuments[1]).toBe(replacement);
		expect(documents[1]).toBe(middle);

		const appendedDocuments = upsertProjectionDocument(replacedDocuments, {
			id: "appended",
			revision: "1",
			nodes: [{ kind: "text", id: "appended-node", text: "Appended" }],
		});
		expect(appendedDocuments.map((document) => document.id)).toEqual([
			"first",
			"middle",
			"last",
			"appended",
		]);

		const original: ProjectionDocument = {
			id: "panel",
			revision: "1",
			nodes: [
				{ kind: "text", id: "first", text: "First" },
				{ kind: "text", id: "middle", text: "Before" },
				{ kind: "text", id: "last", text: "Last" },
			],
		};
		const replacedNode = applyProjectionDocumentPatch(original, {
			documentId: "panel",
			baseRevision: "1",
			revision: "2",
			type: "set-node",
			node: { kind: "text", id: "middle", text: "After" },
		});
		expect(replacedNode).toEqual({
			ok: true,
			document: {
				...original,
				revision: "2",
				nodes: [
					{ kind: "text", id: "first", text: "First" },
					{ kind: "text", id: "middle", text: "After" },
					{ kind: "text", id: "last", text: "Last" },
				],
			},
		});
		expect(original.nodes[1]).toEqual({
			kind: "text",
			id: "middle",
			text: "Before",
		});
		if (replacedNode.ok) {
			expect(
				applyProjectionDocumentPatch(replacedNode.document, {
					documentId: "panel",
					baseRevision: "2",
					revision: "3",
					type: "set-node",
					node: { kind: "text", id: "appended", text: "Appended" },
				}),
			).toMatchObject({
				ok: true,
				document: {
					nodes: [
						{ id: "first" },
						{ id: "middle" },
						{ id: "last" },
						{ id: "appended" },
					],
				},
			});
		}
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

	it("rejects a patch that would remove the final document node", () => {
		const original: ProjectionDocument = {
			id: "panel",
			revision: "opaque-current",
			nodes: [{ kind: "text", id: "summary", text: "Authoritative" }],
		};

		expect(
			applyProjectionDocumentPatch(original, {
				documentId: "panel",
				baseRevision: "opaque-current",
				revision: "opaque-next",
				type: "remove-node",
				nodeId: "summary",
			}),
		).toEqual({
			ok: false,
			code: "invalid-document",
			reason: 'Projection document "panel" must retain at least one node.',
		});
		expect(original).toEqual({
			id: "panel",
			revision: "opaque-current",
			nodes: [{ kind: "text", id: "summary", text: "Authoritative" }],
		});
	});
});

describe("projection targets", () => {
	const flushMicrotasks = () =>
		new Promise<void>((resolve) => queueMicrotask(resolve));

	it("resolves the paired schema inspection exactly once", () => {
		const adapter: IgniteAdapter<{ sequence: number }, InspectionEvent> = {
			scope: StateScope.Isolated,
			subscribeSnapshots: () => ({ unsubscribe: () => undefined }),
			send: () => undefined,
			getSnapshot: vi.fn(() => ({ sequence: 99 })),
			stop: vi.fn(),
		};
		const resolveInspection = vi.fn(() => ({
			snapshot: { sequence: 1 },
			view: { sequence: 1 },
		}));
		const resolveView = vi.fn(() => ({ sequence: 99 }));
		const runtime = createAgentRuntime({
			eventTypes: [],
			resolveInspection,
			resolveRuntime: () => ({
				adapter,
				additionalArgs: {},
				host: new EventTarget(),
			}),
			resolveView,
		});

		expect(runtime.getSchema()).toMatchObject({
			snapshot: { sequence: 1 },
			view: { sequence: 1 },
		});
		expect(resolveInspection).toHaveBeenCalledOnce();
		expect(adapter.getSnapshot).not.toHaveBeenCalled();
		expect(resolveView).not.toHaveBeenCalled();
	});

	it("skips enumerable command accessors in schema and projection inspection", async () => {
		const document: ProjectionDocument = {
			id: "descriptor-panel",
			revision: "1",
			nodes: [{ kind: "text", id: "summary", text: "Ready" }],
		};
		const snapshot = { documents: [document], speech: null };
		const adapter: IgniteAdapter<typeof snapshot, InspectionEvent> = {
			scope: StateScope.Isolated,
			subscribeSnapshots: () => ({ unsubscribe: () => undefined }),
			send: () => undefined,
			getSnapshot: () => snapshot,
			stop: vi.fn(),
		};
		const createAdapter = Object.assign(() => adapter, {
			scope: StateScope.Isolated,
			resolveStateSnapshot: (
				current: IgniteAdapter<typeof snapshot, InspectionEvent>,
			) => current.getSnapshot(),
		});
		const getter = vi.fn(() => {
			throw new Error("command accessor invoked");
		});
		const additionalArgs = {};
		Object.defineProperty(additionalArgs, "accessorCommand", {
			enumerable: true,
			get: getter,
		});
		const core = createComponentFactory(createAdapter, {
			view: () => ({}),
			commands: () => ({}),
			createAdditionalArgs: () => additionalArgs,
			createRenderStrategy: () => ({
				attach: () => undefined,
				render: () => undefined,
			}),
		});

		const getSchema = Reflect.get(core, "getSchema");
		expect(typeof getSchema).toBe("function");
		if (typeof getSchema !== "function") {
			throw new Error("component factory is missing getSchema");
		}
		const schema = Reflect.apply(getSchema, core, []);
		if (typeof schema !== "object" || schema === null) {
			throw new Error("component factory returned an invalid schema");
		}
		expect(Reflect.get(schema, "commands")).toEqual({});
		expect(getter).not.toHaveBeenCalled();

		const commitDocument = vi.fn();
		const session = Reflect.apply(core, undefined, [
			createProjectionDocumentTarget({ commitDocument }),
		]);
		await flushMicrotasks();
		await flushMicrotasks();

		expect(commitDocument).toHaveBeenCalledWith(document);
		expect(getter).not.toHaveBeenCalled();
		const dispose = Reflect.get(session, "dispose");
		expect(typeof dispose).toBe("function");
		if (typeof dispose === "function") {
			Reflect.apply(dispose, session, []);
		}
	});

	it("delivers the first post-install watcher update after synchronous seeds", () => {
		type Snapshot = { value: number };

		for (const synchronousSeeds of [
			[],
			[{ value: 1 }],
			[{ value: 1 }, { value: 2 }, { value: 3 }],
		]) {
			let current: Snapshot = { value: 0 };
			let notify: (() => void) | undefined;
			const unsubscribe = vi.fn();
			const retainRuntimeAccess = vi.fn();
			const releaseRuntimeAccess = vi.fn();
			const adapter: IgniteAdapter<Snapshot, InspectionEvent> = {
				scope: StateScope.Isolated,
				subscribeSnapshots: (listener) => {
					notify = () => listener(current);
					for (const seed of synchronousSeeds) {
						current = seed;
						listener(current);
					}
					return { unsubscribe };
				},
				send: () => undefined,
				getSnapshot: () => current,
				stop: vi.fn(),
			};
			const handler = vi.fn(
				(_snapshot: Snapshot, _previous: Snapshot): void => undefined,
			);
			const runtime = createAgentRuntime({
				eventTypes: [],
				retainRuntimeAccess,
				releaseRuntimeAccess,
				resolveRuntime: () => ({
					adapter,
					additionalArgs: {},
					host: new EventTarget(),
				}),
				resolveView: () => ({}),
			});

			const subscription = runtime.watchSnapshot(handler);
			const lastSeed = current;
			expect(handler).not.toHaveBeenCalled();

			current = { value: 10 };
			notify?.();
			current = { value: 11 };
			notify?.();

			expect(handler).toHaveBeenNthCalledWith(1, { value: 10 }, lastSeed);
			expect(handler).toHaveBeenNthCalledWith(2, { value: 11 }, { value: 10 });
			expect(retainRuntimeAccess).toHaveBeenCalledOnce();

			subscription.unsubscribe();
			expect(unsubscribe).toHaveBeenCalledOnce();
			expect(releaseRuntimeAccess).toHaveBeenCalledOnce();
		}
	});

	it("uses one transformed inspection pair for schema and projection validation", async () => {
		type SourceSnapshot = { sequence: number };
		type FacadeSnapshot = InspectionSnapshot & { sequence: number };

		let sequence = 0;
		const adapter: IgniteAdapter<SourceSnapshot, InspectionEvent> = {
			scope: StateScope.Isolated,
			subscribeSnapshots: () => ({ unsubscribe: () => undefined }),
			send: () => undefined,
			getSnapshot: vi.fn(() => {
				sequence += 1;
				return { sequence };
			}),
			stop: vi.fn(),
		};
		const resolveStateSnapshot = vi.fn(
			(
				current: IgniteAdapter<SourceSnapshot, InspectionEvent>,
			): FacadeSnapshot => {
				const source = current.getSnapshot();
				return {
					sequence: source.sequence,
					context: {
						documents: [
							{
								id: "coherent-panel",
								revision: String(source.sequence),
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
		);
		const createAdapter = Object.assign(() => adapter, {
			scope: StateScope.Isolated,
			resolveStateSnapshot,
		});
		const availabilitySequences: number[] = [];
		const core = createIgniteComponentFactory(createAdapter, {
			view: ({ snapshot }) => ({
				sequence: snapshot.sequence,
				documentRevision: snapshot.context.documents[0]?.revision ?? null,
			}),
			commands: ({ command: createCommand }) => ({
				confirm: createCommand((_payload: { value: number }) => undefined, {
					input: command.object({ value: command.number() }),
					canExecute: ({ snapshot }) => {
						availabilitySequences.push(snapshot.sequence);
						return snapshot.context.allowConfirm;
					},
				}),
			}),
		});

		const schema = core.getSchema();

		expect(resolveStateSnapshot).toHaveBeenCalledTimes(2);
		expect(adapter.getSnapshot).toHaveBeenCalledTimes(2);
		expect(schema.snapshot).toMatchObject({
			sequence: 2,
			context: {
				documents: [{ revision: "2" }],
			},
		});
		expect(schema.view).toEqual({
			sequence: 2,
			documentRevision: "2",
		});
		resolveStateSnapshot.mockClear();
		vi.mocked(adapter.getSnapshot).mockClear();
		expect(core.canExecute("confirm")).toBe(true);
		expect(resolveStateSnapshot).toHaveBeenCalledOnce();
		expect(adapter.getSnapshot).toHaveBeenCalledOnce();
		expect(availabilitySequences).toEqual([3]);
		resolveStateSnapshot.mockClear();
		vi.mocked(adapter.getSnapshot).mockClear();

		const commitDocument = vi.fn<(document: ProjectionDocument) => void>();
		const session = core(createProjectionDocumentTarget({ commitDocument }));
		await flushMicrotasks();
		await flushMicrotasks();

		expect(resolveStateSnapshot).toHaveBeenCalledOnce();
		expect(adapter.getSnapshot).toHaveBeenCalledTimes(2);
		expect(commitDocument).toHaveBeenCalledTimes(1);
		expect(availabilitySequences).toEqual([
			3,
			Number(commitDocument.mock.calls[0]?.[0].revision),
		]);

		session.dispose();
	});

	it("evaluates one initial projection after watcher setup succeeds", async () => {
		const document: ProjectionDocument = {
			id: "watcher-panel",
			revision: "1",
			nodes: [{ kind: "text", id: "summary", text: "Ready" }],
		};

		for (const synchronousCallbacks of [0, 1, 3]) {
			const snapshot = { documents: [document], speech: null };
			const unsubscribe = vi.fn();
			const adapter: IgniteAdapter<typeof snapshot, { type: "NOOP" }> = {
				scope: StateScope.Isolated,
				subscribeSnapshots: (listener) => {
					for (let index = 0; index < synchronousCallbacks; index += 1) {
						listener(snapshot);
					}
					return { unsubscribe };
				},
				send: () => undefined,
				getSnapshot: () => snapshot,
				stop: vi.fn(),
			};
			const createAdapter = Object.assign(() => adapter, {
				scope: StateScope.Isolated,
				resolveStateSnapshot: (
					current: IgniteAdapter<typeof snapshot, { type: "NOOP" }>,
				) => current.getSnapshot(),
			});
			const core = createIgniteComponentFactory(createAdapter, {
				view: () => ({}),
				commands: () => ({}),
			});
			const commitDocument = vi.fn();
			const session = core(createProjectionDocumentTarget({ commitDocument }));

			expect(commitDocument).not.toHaveBeenCalled();
			await flushMicrotasks();
			await flushMicrotasks();
			expect(commitDocument).toHaveBeenCalledTimes(1);

			session.dispose();
			session.dispose();
			expect(unsubscribe).toHaveBeenCalledTimes(1);
		}
	});

	it("cancels queued projection work when immediately disposed", async () => {
		const document: ProjectionDocument = {
			id: "disposed-panel",
			revision: "1",
			nodes: [{ kind: "text", id: "summary", text: "Never commit" }],
		};
		const snapshot = { documents: [document], speech: null };
		const unsubscribeError = new Error("watcher unsubscribe failed");
		const unsubscribe = vi.fn(() => {
			throw unsubscribeError;
		});
		const adapter: IgniteAdapter<typeof snapshot, { type: "NOOP" }> = {
			scope: StateScope.Isolated,
			subscribeSnapshots: (listener) => {
				listener(snapshot);
				listener(snapshot);
				return { unsubscribe };
			},
			send: () => undefined,
			getSnapshot: () => snapshot,
			stop: vi.fn(),
		};
		const createAdapter = Object.assign(() => adapter, {
			scope: StateScope.Isolated,
			resolveStateSnapshot: (
				current: IgniteAdapter<typeof snapshot, { type: "NOOP" }>,
			) => current.getSnapshot(),
		});
		const core = createIgniteComponentFactory(createAdapter, {
			view: () => ({}),
			commands: () => ({}),
		});
		const commitDocument = vi.fn();
		const session = core(createProjectionDocumentTarget({ commitDocument }));

		expect(() => session.dispose()).toThrow(unsubscribeError);
		expect(() => session.dispose()).not.toThrow();
		await flushMicrotasks();
		await flushMicrotasks();

		expect(unsubscribe).toHaveBeenCalledTimes(1);
		expect(commitDocument).not.toHaveBeenCalled();
	});

	it("balances shared runtime access when watcher setup fails", async () => {
		const document: ProjectionDocument = {
			id: "shared-panel",
			revision: "1",
			nodes: [{ kind: "text", id: "summary", text: "Ready" }],
		};
		const snapshot = { documents: [document], speech: null };
		let failWatcherSetup = true;
		const unsubscribe = vi.fn();
		const stop = vi.fn();
		const adapter: IgniteAdapter<typeof snapshot, { type: "NOOP" }> = {
			scope: StateScope.Shared,
			subscribeSnapshots: (listener) => {
				if (failWatcherSetup) {
					throw new Error("watcher setup failed");
				}
				listener(snapshot);
				return { unsubscribe };
			},
			send: () => undefined,
			getSnapshot: () => snapshot,
			stop,
		};
		const createAdapter = Object.assign(() => adapter, {
			scope: StateScope.Shared,
			resolveStateSnapshot: (
				current: IgniteAdapter<typeof snapshot, { type: "NOOP" }>,
			) => current.getSnapshot(),
		});
		const core = createComponentFactory(createAdapter, {
			view: () => ({}),
			commands: () => ({}),
			cleanup: true,
			createRenderStrategy: () => ({
				attach: () => undefined,
				render: () => undefined,
			}),
		});
		const ghostCommit = vi.fn();
		let registeredConstructor: CustomElementConstructor | undefined;
		const defineSpy = vi
			.spyOn(customElements, "define")
			.mockImplementation((_name, elementConstructor) => {
				registeredConstructor = elementConstructor;
			});
		const addEventListenerDescriptor = Object.getOwnPropertyDescriptor(
			HTMLElement.prototype,
			"addEventListener",
		);
		const removeEventListenerDescriptor = Object.getOwnPropertyDescriptor(
			HTMLElement.prototype,
			"removeEventListener",
		);
		Object.defineProperty(HTMLElement.prototype, "addEventListener", {
			value: () => undefined,
			configurable: true,
		});
		Object.defineProperty(HTMLElement.prototype, "removeEventListener", {
			value: () => undefined,
			configurable: true,
		});

		try {
			expect(() =>
				Reflect.apply(core, undefined, [
					createProjectionDocumentTarget({ commitDocument: ghostCommit }),
				]),
			).toThrow("watcher setup failed");
			failWatcherSetup = false;
			core(`shared-cleanup-${crypto.randomUUID()}`, () => "ready");
			expect(registeredConstructor).toBeDefined();
			if (!registeredConstructor) {
				return;
			}
			const element = new registeredConstructor();
			const connect = Reflect.get(element, "connectedCallback");
			const disconnect = Reflect.get(element, "disconnectedCallback");
			expect(connect).toBeTypeOf("function");
			expect(disconnect).toBeTypeOf("function");
			if (typeof connect !== "function" || typeof disconnect !== "function") {
				return;
			}
			Reflect.apply(connect, element, []);
			Reflect.apply(disconnect, element, []);
			await flushMicrotasks();
			await flushMicrotasks();

			expect(ghostCommit).not.toHaveBeenCalled();
			expect(stop).toHaveBeenCalledTimes(1);
		} finally {
			defineSpy.mockRestore();
			if (addEventListenerDescriptor) {
				Object.defineProperty(
					HTMLElement.prototype,
					"addEventListener",
					addEventListenerDescriptor,
				);
			} else {
				Reflect.deleteProperty(HTMLElement.prototype, "addEventListener");
			}
			if (removeEventListenerDescriptor) {
				Object.defineProperty(
					HTMLElement.prototype,
					"removeEventListener",
					removeEventListenerDescriptor,
				);
			} else {
				Reflect.deleteProperty(HTMLElement.prototype, "removeEventListener");
			}
		}
	});

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

		expect(adapter.getSnapshot).toHaveBeenCalledTimes(3);
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

	it("rejects executable content in every preserved JSON island", async () => {
		const islands: ProjectionJsonIsland[] = [
			"action-payload",
			"submit-payload",
			"form-input",
			"form-value",
			"table-cell",
		];
		const dangerousValues: { name: string; value: IgniteSchemaValue }[] = [
			{
				name: "dangerouslySetInnerHTML",
				value: {
					dangerouslySetInnerHTML: { __html: "<script>unsafe()</script>" },
				},
			},
			{ name: "innerHTML", value: { INNERHTML: "<script>unsafe()</script>" } },
			{ name: "outerHTML", value: { OuTeRhTmL: "<script>unsafe()</script>" } },
			{ name: "srcdoc", value: { SRCDOC: "<script>unsafe()</script>" } },
			{ name: "existing forbidden key", value: { JSX: "unsafe" } },
			{ name: "generic handler key", value: { ONPointerDown: "unsafe" } },
			{ name: "javascript URI", value: { href: "javascript:unsafe()" } },
			{
				name: "obfuscated javascript URI",
				value: { SRC: "\u0000 \tJaVa\nScRiPt\r:unsafe()\u007f " },
			},
			{
				name: "obfuscated vbscript URI",
				value: { "xlink:href": "\tvb\rscript\n:unsafe()" },
			},
			{
				name: "HTML data URI",
				value: {
					action: "data:text/html;charset=utf-8,<script>unsafe()</script>",
				},
			},
			{
				name: "XHTML data URI",
				value: {
					FORMAction: " DATA:application/xhtml+xml;base64,PHhodG1sPg== ",
				},
			},
			{
				name: "SVG data URI",
				value: { href: "data:\nimage/svg+xml;charset=utf-8,<svg></svg>" },
			},
			{
				name: "single executable URI array",
				value: { href: ["javascript:unsafe()"] },
			},
			{
				name: "nested executable URI array",
				value: { SRC: [["\tJaVa\nScRiPt:unsafe()"]] },
			},
			{
				name: "executable URI array with trailing null",
				value: { action: ["vbscript:unsafe()", null] },
			},
			{
				name: "executable data URI array with trailing blockers",
				value: {
					FORMAction: ["data:text/html,<script>unsafe()</script>", {}, true, 1],
				},
			},
		];
		const errorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		let scenarioIndex = 0;

		try {
			for (const dangerous of dangerousValues) {
				for (const island of islands) {
					scenarioIndex += 1;
					const core = createProjectionCore();
					const commitDocument = vi.fn();
					const session = core(
						createProjectionDocumentTarget({ commitDocument }),
					);
					const document = createJsonIslandDocument(
						island,
						dangerous.value,
						`unsafe-${scenarioIndex}`,
					);

					await core.execute("upsertProjection", document);
					await flushMicrotasks();

					expect(
						commitDocument,
						`${dangerous.name} in ${island}`,
					).not.toHaveBeenCalled();
					session.dispose();
				}
			}
		} finally {
			errorSpy.mockRestore();
		}
	});

	it("applies deterministic join-like URI analysis to canonical JSON data", async () => {
		const cases: Array<{
			name: string;
			value: IgniteSchemaValue;
			allowed: boolean;
		}> = [
			{ name: "empty array", value: { href: [] }, allowed: true },
			{ name: "nested empty array", value: { href: [[]] }, allowed: true },
			{
				name: "leading null",
				value: { href: [null, "javascript:unsafe()"] },
				allowed: true,
			},
			{
				name: "trailing null",
				value: { href: ["javascript:unsafe()", null] },
				allowed: false,
			},
			{
				name: "trailing nested empty array",
				value: { href: ["javascript:unsafe()", []] },
				allowed: false,
			},
			{
				name: "comma-split scheme",
				value: { href: ["java", "script:unsafe()"] },
				allowed: true,
			},
			{
				name: "object blocker before scheme",
				value: { href: [{}, "javascript:unsafe()"] },
				allowed: true,
			},
			{
				name: "boolean blocker before scheme",
				value: { href: [true, "javascript:unsafe()"] },
				allowed: true,
			},
			{
				name: "number blocker before scheme",
				value: { href: [1, "javascript:unsafe()"] },
				allowed: true,
			},
			{
				name: "object blocker after scheme",
				value: { href: ["javascript:unsafe()", {}] },
				allowed: false,
			},
			{
				name: "boolean blocker after scheme",
				value: { href: ["javascript:unsafe()", false] },
				allowed: false,
			},
			{
				name: "number blocker after scheme",
				value: { href: ["javascript:unsafe()", 0] },
				allowed: false,
			},
			{
				name: "nested executable array",
				value: { href: [["javascript:unsafe()"]] },
				allowed: false,
			},
			{
				name: "safe HTTPS array",
				value: { href: ["https://example.com/path"] },
				allowed: true,
			},
			{
				name: "safe relative array",
				value: { href: [["../relative/path"]] },
				allowed: true,
			},
			{
				name: "safe image data array",
				value: { src: ["data:image/png;base64,iVBORw0KGgo="] },
				allowed: true,
			},
			{ name: "direct null", value: { href: null }, allowed: true },
			{ name: "direct boolean", value: { href: true }, allowed: true },
			{ name: "direct finite number", value: { href: 42 }, allowed: true },
			{
				name: "direct plain object",
				value: { href: { label: "javascript:ordinary business text" } },
				allowed: true,
			},
			{
				name: "nested URI child in object",
				value: { href: { child: { src: ["javascript:unsafe()"] } } },
				allowed: false,
			},
			{
				name: "nested URI child in array",
				value: {
					href: [{ child: { action: [["data:image/svg+xml,<svg></svg>"]] } }],
				},
				allowed: false,
			},
		];
		const errorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		try {
			for (let index = 0; index < cases.length; index += 1) {
				const scenario = cases[index];
				if (!scenario) {
					continue;
				}
				const core = createProjectionCore();
				const commitDocument = vi.fn();
				const session = core(
					createProjectionDocumentTarget({ commitDocument }),
				);
				const document = createJsonIslandDocument(
					"table-cell",
					scenario.value,
					`uri-array-${index}`,
				);

				await core.execute("upsertProjection", document);
				await flushMicrotasks();

				if (scenario.allowed) {
					expect(commitDocument, scenario.name).toHaveBeenCalledWith(document);
				} else {
					expect(commitDocument, scenario.name).not.toHaveBeenCalled();
				}
				session.dispose();
			}
		} finally {
			errorSpy.mockRestore();
		}
	});

	it("rejects URI coercion hooks without invoking application code", async () => {
		const toStringHook = vi.fn(() => "javascript:unsafe()");
		const valueOfHook = vi.fn(() => "javascript:unsafe()");
		const toJsonHook = vi.fn(() => "javascript:unsafe()");
		const joinHook = vi.fn(() => "javascript:unsafe()");
		const iteratorHook = vi.fn(() =>
			["javascript:unsafe()"][Symbol.iterator](),
		);
		const hookValues: unknown[] = [
			{ href: { toString: toStringHook } },
			{ href: { valueOf: valueOfHook } },
			{ href: { toJSON: toJsonHook } },
		];
		const joinArray: unknown[] = ["javascript:unsafe()"];
		Object.defineProperty(joinArray, "join", {
			value: joinHook,
			enumerable: true,
		});
		hookValues.push({ href: joinArray });
		const iterableArray: unknown[] = ["javascript:unsafe()"];
		Object.defineProperty(iterableArray, Symbol.iterator, {
			value: iteratorHook,
			enumerable: true,
		});
		hookValues.push({ href: iterableArray });
		const { core, setDocuments } = createRawProjectionCore();
		const commitDocument = vi.fn();
		const session = core(createProjectionDocumentTarget({ commitDocument }));
		const unhandled: unknown[] = [];
		const captureUnhandled = (reason: unknown) => {
			unhandled.push(reason);
		};

		process.on("unhandledRejection", captureUnhandled);
		try {
			for (let index = 0; index < hookValues.length; index += 1) {
				setDocuments([
					{
						id: `hook-${index}`,
						revision: "1",
						nodes: [
							{
								kind: "table",
								id: "table",
								columns: [{ id: "value", label: "Value" }],
								rows: [{ id: "row", cells: [hookValues[index]] }],
							},
						],
					},
				]);
				await flushMicrotasks();
			}
			await flushMicrotasks();
		} finally {
			process.off("unhandledRejection", captureUnhandled);
			session.dispose();
		}

		expect(toStringHook).not.toHaveBeenCalled();
		expect(valueOfHook).not.toHaveBeenCalled();
		expect(toJsonHook).not.toHaveBeenCalled();
		expect(joinHook).not.toHaveBeenCalled();
		expect(iteratorHook).not.toHaveBeenCalled();
		expect(commitDocument).not.toHaveBeenCalled();
		expect(unhandled).toEqual([]);
	});

	it("preserves safe business data and URLs in every JSON island", async () => {
		const safeBusinessData: IgniteSchemaValue = {
			customer: {
				id: "customer-1",
				tags: ["priority", "javascript: is a language"],
			},
			links: [
				{ href: "https://example.com/profile" },
				{ href: "../relative/profile" },
				{ src: "data:image/png;base64,iVBORw0KGgo=" },
				{ "xlink:href": "http://example.com/icon" },
				{ action: "approve" },
				{ formAction: "mailto:support@example.com" },
			],
			note: "javascript:alert(1) is inert business text",
		};
		const document: ProjectionDocument = {
			id: "safe-business-data",
			revision: "1",
			nodes: [
				{
					kind: "text",
					id: "text",
					text: "javascript: appears in ordinary projection text",
				},
				{
					kind: "action",
					id: "confirm",
					label: "Confirm",
					commandName: "confirm",
					payload: { value: 2, safeBusinessData },
				},
				{
					kind: "form",
					id: "form",
					fields: [
						{
							id: "name",
							label: "Name",
							input: { type: "string", safeBusinessData },
							value: safeBusinessData,
						},
					],
					submit: {
						kind: "action",
						id: "submit",
						label: "Submit",
						commandName: "confirm",
						payload: { value: 2, safeBusinessData },
					},
				},
				{
					kind: "table",
					id: "table",
					columns: [{ id: "value", label: "Value" }],
					rows: [{ id: "row", cells: [safeBusinessData] }],
				},
			],
		};
		const core = createProjectionCore();
		const commitDocument = vi.fn<(value: ProjectionDocument) => void>();
		const session = core(createProjectionDocumentTarget({ commitDocument }));

		await core.execute("upsertProjection", document);
		await flushMicrotasks();

		expect(commitDocument).toHaveBeenCalledTimes(1);
		expect(commitDocument).toHaveBeenCalledWith(document);
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

	it("rejects unsafe actor-owned document collections without invoking code", async () => {
		const validDocument: ProjectionDocument = {
			id: "panel",
			revision: "1",
			nodes: [{ kind: "text", id: "summary", text: "Ready" }],
		};
		const scenarios = [
			{
				name: "index getter",
				create: (document: ProjectionDocument) => {
					const invoked = vi.fn();
					const documents: unknown[] = [];
					Object.defineProperty(documents, "0", {
						enumerable: true,
						configurable: true,
						get: () => {
							invoked();
							return document;
						},
					});
					return { documents, invoked };
				},
			},
			{
				name: "throwing index getter",
				create: (_document: ProjectionDocument) => {
					const invoked = vi.fn();
					const documents: unknown[] = [];
					Object.defineProperty(documents, "0", {
						enumerable: true,
						configurable: true,
						get: () => {
							invoked();
							throw new Error("index getter invoked");
						},
					});
					return { documents, invoked };
				},
			},
			{
				name: "custom iterator",
				create: (document: ProjectionDocument) => {
					const invoked = vi.fn();
					const documents: unknown[] = [document];
					Object.defineProperty(documents, Symbol.iterator, {
						value: () => {
							invoked();
							return [document][Symbol.iterator]();
						},
					});
					return { documents, invoked };
				},
			},
			{
				name: "symbol property",
				create: (document: ProjectionDocument) => {
					const invoked = vi.fn();
					const documents: unknown[] = [document];
					Object.defineProperty(documents, Symbol("unsafe"), {
						value: "unsafe",
						enumerable: true,
					});
					return { documents, invoked };
				},
			},
			{
				name: "enumerable extra string property",
				create: (document: ProjectionDocument) => {
					const invoked = vi.fn();
					const documents: unknown[] = [document];
					Object.defineProperty(documents, "metadata", {
						value: "unsafe",
						enumerable: true,
					});
					return { documents, invoked };
				},
			},
			{
				name: "non-enumerable extra string property",
				create: (document: ProjectionDocument) => {
					const invoked = vi.fn();
					const documents: unknown[] = [document];
					Object.defineProperty(documents, "metadata", {
						value: "unsafe",
						enumerable: false,
					});
					return { documents, invoked };
				},
			},
			{
				name: "non-enumerable index",
				create: (document: ProjectionDocument) => {
					const invoked = vi.fn();
					const documents: unknown[] = [];
					Object.defineProperty(documents, "0", {
						value: document,
						enumerable: false,
						configurable: true,
					});
					return { documents, invoked };
				},
			},
			{
				name: "sparse array",
				create: (document: ProjectionDocument) => {
					const invoked = vi.fn();
					const documents: unknown[] = [];
					Object.defineProperty(documents, "length", { value: 2 });
					Object.defineProperty(documents, "1", {
						value: document,
						enumerable: true,
						configurable: true,
					});
					return { documents, invoked };
				},
			},
			{
				name: "array subclass",
				create: (document: ProjectionDocument) => {
					const invoked = vi.fn();
					class DocumentCollection extends Array<unknown> {
						[Symbol.iterator]() {
							invoked();
							return super[Symbol.iterator]();
						}
					}
					const documents = new DocumentCollection();
					documents.push(document);
					return { documents, invoked };
				},
			},
			{
				name: "mixed valid and invalid documents",
				create: (document: ProjectionDocument) => ({
					documents: [document, { id: "broken" }],
					invoked: vi.fn(),
				}),
			},
		];
		const unhandled: unknown[] = [];
		const captureUnhandled = (reason: unknown) => {
			unhandled.push(reason);
		};

		process.on("unhandledRejection", captureUnhandled);
		try {
			for (const scenario of scenarios) {
				const { core, setDocuments } = createRawProjectionCore();
				const commitDocument = vi.fn();
				const session = core(
					createProjectionDocumentTarget({ commitDocument }),
				);
				const { documents, invoked } = scenario.create(validDocument);

				setDocuments(documents);
				await flushMicrotasks();
				await flushMicrotasks();

				expect(invoked, scenario.name).not.toHaveBeenCalled();
				expect(commitDocument, scenario.name).not.toHaveBeenCalled();
				session.dispose();
			}
		} finally {
			process.off("unhandledRejection", captureUnhandled);
		}

		expect(unhandled).toEqual([]);
	});

	it("contains invalid-length and throwing proxy descriptor traps", async () => {
		const invalidLengthTrap = vi.fn(
			(target: unknown[], property: string | symbol) =>
				property === "length"
					? {
							value: "invalid",
							writable: true,
							enumerable: false,
							configurable: false,
						}
					: Reflect.getOwnPropertyDescriptor(target, property),
		);
		const throwingTrap = vi.fn(() => {
			throw new Error("descriptor trap failed");
		});
		const scenarios = [
			new Proxy<unknown[]>([], {
				getOwnPropertyDescriptor: invalidLengthTrap,
			}),
			new Proxy<unknown[]>([], {
				getOwnPropertyDescriptor: throwingTrap,
			}),
		];
		const unhandled: unknown[] = [];
		const captureUnhandled = (reason: unknown) => {
			unhandled.push(reason);
		};

		process.on("unhandledRejection", captureUnhandled);
		try {
			for (const documents of scenarios) {
				const { core, setDocuments } = createRawProjectionCore();
				const commitDocument = vi.fn();
				const session = core(
					createProjectionDocumentTarget({ commitDocument }),
				);

				setDocuments(documents);
				await flushMicrotasks();
				await flushMicrotasks();

				expect(commitDocument).not.toHaveBeenCalled();
				session.dispose();
			}
		} finally {
			process.off("unhandledRejection", captureUnhandled);
		}

		expect(invalidLengthTrap).toHaveBeenCalled();
		expect(throwingTrap).toHaveBeenCalled();
		expect(unhandled).toEqual([]);
	});

	it("commits only trusted dense document arrays", async () => {
		const document: ProjectionDocument = {
			id: "panel",
			revision: "1",
			nodes: [{ kind: "text", id: "summary", text: "Ready" }],
		};
		const { core, setDocuments } = createRawProjectionCore();
		const commitDocument = vi.fn();
		const session = core(createProjectionDocumentTarget({ commitDocument }));

		setDocuments([document]);
		await flushMicrotasks();
		await flushMicrotasks();

		expect(commitDocument).toHaveBeenCalledTimes(1);
		expect(commitDocument).toHaveBeenCalledWith(document);
		session.dispose();
	});

	it("does not fall back to derived documents after an unsafe actor collection", async () => {
		const actorDocument: ProjectionDocument = {
			id: "panel",
			revision: "actor-1",
			nodes: [{ kind: "text", id: "actor", text: "Actor" }],
		};
		const derivedDocument: ProjectionDocument = {
			id: "panel",
			revision: "derived-1",
			nodes: [{ kind: "text", id: "derived", text: "Derived" }],
		};
		const iterator = vi.fn(() => [actorDocument][Symbol.iterator]());
		const actorDocuments: unknown[] = [actorDocument];
		Object.defineProperty(actorDocuments, Symbol.iterator, { value: iterator });
		const { core, setDocuments } = createRawProjectionCore(() => ({
			documents: [derivedDocument],
		}));
		const commitDocument = vi.fn();
		const session = core(createProjectionDocumentTarget({ commitDocument }));

		setDocuments(actorDocuments);
		await flushMicrotasks();
		await flushMicrotasks();

		expect(iterator).not.toHaveBeenCalled();
		expect(commitDocument).not.toHaveBeenCalled();
		session.dispose();
	});

	it("fails speech accessors and non-data shapes closed without scanning text", async () => {
		const outerGetter = vi.fn(() => {
			throw new Error("outer speech getter invoked");
		});
		const outerAccessorSnapshot = { documents: [] };
		Object.defineProperty(outerAccessorSnapshot, "speech", {
			enumerable: true,
			get: outerGetter,
		});
		const valueGetter = vi.fn(() => {
			throw new Error("speech value getter invoked");
		});
		const accessorSpeech = {
			id: "accessor",
			text: "Unsafe",
			status: "pending",
		};
		Object.defineProperty(accessorSpeech, "voice", {
			enumerable: true,
			get: valueGetter,
		});
		const symbolSpeech = {
			id: "symbol",
			text: "Unsafe",
			status: "pending",
		};
		Object.defineProperty(symbolSpeech, Symbol("unsafe"), {
			value: "unsafe",
		});
		class NonPlainSpeech {
			id = "non-plain";
			text = "Unsafe";
			status = "pending";
		}
		const scenarios = [
			{ snapshot: outerAccessorSnapshot, invoked: outerGetter },
			{
				snapshot: { documents: [], speech: accessorSpeech },
				invoked: valueGetter,
			},
			{
				snapshot: { documents: [], speech: symbolSpeech },
				invoked: vi.fn(),
			},
			{
				snapshot: { documents: [], speech: new NonPlainSpeech() },
				invoked: vi.fn(),
			},
		];
		const unhandled: unknown[] = [];
		const captureUnhandled = (reason: unknown) => {
			unhandled.push(reason);
		};

		process.on("unhandledRejection", captureUnhandled);
		try {
			for (const scenario of scenarios) {
				const { core, setSnapshot } = createRawProjectionCore();
				const commitSpeech = vi.fn();
				const session = core(
					createProjectionSpeechTarget({
						commitSpeech,
						acknowledgeCommandName: "acknowledgeSpeech",
					}),
				);

				setSnapshot(scenario.snapshot);
				await flushMicrotasks();
				await flushMicrotasks();

				expect(scenario.invoked).not.toHaveBeenCalled();
				expect(commitSpeech).not.toHaveBeenCalled();
				session.dispose();
			}
		} finally {
			process.off("unhandledRejection", captureUnhandled);
		}

		expect(unhandled).toEqual([]);

		const { core, setSpeech } = createRawProjectionCore();
		const commitSpeech = vi.fn<(speech: ProjectionSpeechRequest) => void>();
		const session = core(
			createProjectionSpeechTarget({
				commitSpeech,
				acknowledgeCommandName: "acknowledgeSpeech",
			}),
		);
		setSpeech({
			id: "safe-speech",
			text: "javascript: is ordinary speech text",
			status: "pending",
			voice: "vbscript: is an inert voice label",
			href: "javascript:unknown fields are stripped",
			innerHTML: "unknown fields are stripped",
		});
		await flushMicrotasks();
		await flushMicrotasks();

		expect(commitSpeech).toHaveBeenCalledWith({
			id: "safe-speech",
			text: "javascript: is ordinary speech text",
			status: "pending",
			voice: "vbscript: is an inert voice label",
		});
		session.dispose();
	});

	it("fails isolated XState projection accessors closed before derived fallback", async () => {
		const documentGetter = vi.fn(() => [
			{
				id: "actor-document",
				revision: "1",
				nodes: [{ kind: "text", id: "actor", text: "Actor" }],
			},
		]);
		const speechGetter = vi.fn(() => {
			throw new Error("speech getter invoked");
		});
		const context = { allowConfirm: true };
		Object.defineProperty(context, "documents", {
			enumerable: true,
			get: documentGetter,
		});
		Object.defineProperty(context, "speech", {
			enumerable: true,
			get: speechGetter,
		});
		const machine = createMachine({
			context,
			initial: "active",
			states: { active: {} },
		});
		const derivedDocument: ProjectionDocument = {
			id: "derived-document",
			revision: "1",
			nodes: [{ kind: "text", id: "derived", text: "Derived" }],
		};
		const core = igniteCore({
			source: machine,
			view: () => ({
				documents: [derivedDocument],
				speech: {
					id: "derived-speech",
					text: "Derived speech",
					status: "pending",
				},
			}),
			commands: () => ({ acknowledgeSpeech: () => undefined }),
		});
		const commitDocument = vi.fn();
		const commitSpeech = vi.fn();
		const sessions: Array<{ dispose(): void }> = [];
		const unhandled: unknown[] = [];
		const captureUnhandled = (reason: unknown) => {
			unhandled.push(reason);
		};

		process.on("unhandledRejection", captureUnhandled);
		try {
			expect(() => {
				sessions.push(core(createProjectionDocumentTarget({ commitDocument })));
				sessions.push(
					core(
						createProjectionSpeechTarget({
							commitSpeech,
							acknowledgeCommandName: "acknowledgeSpeech",
						}),
					),
				);
			}).not.toThrow();
			await flushMicrotasks();
			await flushMicrotasks();
		} finally {
			process.off("unhandledRejection", captureUnhandled);
			for (const session of sessions) {
				session.dispose();
			}
		}

		expect(documentGetter).not.toHaveBeenCalled();
		expect(speechGetter).not.toHaveBeenCalled();
		expect(commitDocument).not.toHaveBeenCalled();
		expect(commitSpeech).not.toHaveBeenCalled();
		expect(unhandled).toEqual([]);
	});

	it("fails shared XState projection accessors closed on subsequent snapshots", async () => {
		const documentGetter = vi.fn(() => {
			throw new Error("document getter invoked");
		});
		const speechGetter = vi.fn(() => ({
			id: "actor-speech",
			text: "Actor speech",
			status: "pending",
		}));
		const context = { allowConfirm: true };
		Object.defineProperty(context, "documents", {
			enumerable: true,
			get: documentGetter,
		});
		Object.defineProperty(context, "speech", {
			enumerable: true,
			get: speechGetter,
		});
		const machine = createMachine({
			context,
			initial: "idle",
			states: {
				idle: { on: { NEXT: "active" } },
				active: {},
			},
		});
		const actor = createActor(machine);
		actor.start();
		const core = igniteCore({
			source: actor,
			view: () => ({}),
			commands: () => ({ acknowledgeSpeech: () => undefined }),
		});
		const commitDocument = vi.fn();
		const commitSpeech = vi.fn();
		const sessions: Array<{ dispose(): void }> = [];
		const unhandled: unknown[] = [];
		const captureUnhandled = (reason: unknown) => {
			unhandled.push(reason);
		};

		process.on("unhandledRejection", captureUnhandled);
		try {
			expect(() => {
				sessions.push(core(createProjectionDocumentTarget({ commitDocument })));
				sessions.push(
					core(
						createProjectionSpeechTarget({
							commitSpeech,
							acknowledgeCommandName: "acknowledgeSpeech",
						}),
					),
				);
			}).not.toThrow();
			actor.send({ type: "NEXT" });
			await flushMicrotasks();
			await flushMicrotasks();
		} finally {
			process.off("unhandledRejection", captureUnhandled);
			for (const session of sessions) {
				session.dispose();
			}
			actor.stop();
		}

		expect(documentGetter).not.toHaveBeenCalled();
		expect(speechGetter).not.toHaveBeenCalled();
		expect(commitDocument).not.toHaveBeenCalled();
		expect(commitSpeech).not.toHaveBeenCalled();
		expect(unhandled).toEqual([]);
	});

	it("recovers public XState projection sessions without ghost commits", async () => {
		const initialDocument: ProjectionDocument = {
			id: "panel",
			revision: "1",
			nodes: [{ kind: "text", id: "summary", text: "Initial" }],
		};
		const updatedDocument: ProjectionDocument = {
			id: "panel",
			revision: "2",
			nodes: [{ kind: "text", id: "summary", text: "Updated" }],
		};
		const finalDocument: ProjectionDocument = {
			id: "panel",
			revision: "3",
			nodes: [{ kind: "text", id: "summary", text: "Final" }],
		};
		const context: {
			documents: ProjectionDocument[];
			speech: ProjectionSpeechRequest | null;
		} = {
			documents: [initialDocument],
			speech: {
				id: "speech-1",
				text: "Initial speech",
				status: "pending",
			},
		};
		const machine = createMachine({
			context,
			initial: "idle",
			states: {
				idle: { on: { RECOVER: "active" } },
				active: {
					on: {
						UPDATE: {
							actions: assign({
								documents: () => [updatedDocument],
								speech: () => ({
									id: "speech-2",
									text: "Updated speech",
									status: "pending",
								}),
							}),
						},
						FINAL: {
							actions: assign({
								documents: () => [finalDocument],
								speech: () => ({
									id: "speech-3",
									text: "Final speech",
									status: "pending",
								}),
							}),
						},
					},
				},
			},
		});
		const actor = createActor(machine);
		actor.start();
		const stopSpy = vi.spyOn(actor, "stop");
		const snapshot = actor.getSnapshot();
		const contextDescriptor = Object.getOwnPropertyDescriptor(
			snapshot,
			"context",
		);
		expect(contextDescriptor).toBeDefined();
		if (!contextDescriptor) {
			actor.stop();
			return;
		}
		const contextGetter = vi.fn(() => contextDescriptor.value);
		Reflect.deleteProperty(snapshot, "context");
		const core = igniteCore({
			source: actor,
			view: () => ({}),
			commands: () => ({ acknowledgeSpeech: () => undefined }),
		});
		const ghostDocumentCommit = vi.fn();
		const ghostSpeechCommit = vi.fn();
		const unhandled: unknown[] = [];
		const captureUnhandled = (reason: unknown) => {
			unhandled.push(reason);
		};

		process.on("unhandledRejection", captureUnhandled);
		try {
			expect(() =>
				core(
					createProjectionDocumentTarget({
						commitDocument: ghostDocumentCommit,
					}),
				),
			).toThrow(
				"[XStateAdapter] Snapshot context must be an own data property.",
			);
			Object.defineProperty(snapshot, "context", contextDescriptor);
			actor.send({ type: "RECOVER" });
			await flushMicrotasks();
			await flushMicrotasks();
			expect(ghostDocumentCommit).not.toHaveBeenCalled();

			const repairedSnapshot = actor.getSnapshot();
			const repairedContextDescriptor = Object.getOwnPropertyDescriptor(
				repairedSnapshot,
				"context",
			);
			expect(repairedContextDescriptor).toBeDefined();
			if (!repairedContextDescriptor) {
				return;
			}
			Reflect.deleteProperty(repairedSnapshot, "context");
			Object.defineProperty(repairedSnapshot, "context", {
				enumerable: true,
				configurable: true,
				get: contextGetter,
			});
			expect(() =>
				core(
					createProjectionSpeechTarget({
						commitSpeech: ghostSpeechCommit,
						acknowledgeCommandName: "acknowledgeSpeech",
					}),
				),
			).toThrow(
				"[XStateAdapter] Snapshot context must be an own data property.",
			);
			Object.defineProperty(
				repairedSnapshot,
				"context",
				repairedContextDescriptor,
			);
			await flushMicrotasks();
			await flushMicrotasks();
			expect(ghostDocumentCommit).not.toHaveBeenCalled();
			expect(ghostSpeechCommit).not.toHaveBeenCalled();
			expect(contextGetter).not.toHaveBeenCalled();

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
			expect(commitDocument).toHaveBeenCalledTimes(1);
			expect(commitSpeech).toHaveBeenCalledTimes(1);

			actor.send({ type: "UPDATE" });
			await vi.waitFor(() => {
				expect(commitDocument).toHaveBeenCalledTimes(2);
				expect(commitSpeech).toHaveBeenCalledTimes(2);
			});

			documentSession.dispose();
			speechSession.dispose();
			actor.send({ type: "FINAL" });
			await flushMicrotasks();
			await flushMicrotasks();
			expect(commitDocument).toHaveBeenCalledTimes(2);
			expect(commitSpeech).toHaveBeenCalledTimes(2);
			expect(stopSpy).not.toHaveBeenCalled();
		} finally {
			process.off("unhandledRejection", captureUnhandled);
			actor.stop();
		}

		expect(unhandled).toEqual([]);
	});

	it("recovers an isolated XState projection session after failed initial binding", async () => {
		const initialDocument: ProjectionDocument = {
			id: "isolated-panel",
			revision: "1",
			nodes: [{ kind: "text", id: "summary", text: "Initial" }],
		};
		const updatedDocument: ProjectionDocument = {
			id: "isolated-panel",
			revision: "2",
			nodes: [{ kind: "text", id: "summary", text: "Updated" }],
		};
		const finalDocument: ProjectionDocument = {
			id: "isolated-panel",
			revision: "3",
			nodes: [{ kind: "text", id: "summary", text: "Final" }],
		};
		const machine = createMachine({
			context: { documents: [initialDocument], speech: null },
			initial: "idle",
			states: {
				idle: { on: { RECOVER: "active" } },
				active: {
					on: {
						UPDATE: {
							actions: assign({ documents: () => [updatedDocument] }),
						},
						FINAL: {
							actions: assign({ documents: () => [finalDocument] }),
						},
					},
				},
			},
		});
		const getInitialSnapshot = machine.getInitialSnapshot.bind(machine);
		let capturedSnapshot:
			| ReturnType<typeof machine.getInitialSnapshot>
			| undefined;
		let capturedContextDescriptor: PropertyDescriptor | undefined;
		vi.spyOn(machine, "getInitialSnapshot").mockImplementation(
			(actorScope, input) => {
				const snapshot = getInitialSnapshot(actorScope, input);
				capturedSnapshot = snapshot;
				capturedContextDescriptor = Object.getOwnPropertyDescriptor(
					snapshot,
					"context",
				);
				Reflect.deleteProperty(snapshot, "context");
				return snapshot;
			},
		);
		const core = igniteCore({
			source: machine,
			view: () => ({}),
			commands: ({ actor }) => ({
				recover: () => actor.send({ type: "RECOVER" }),
				update: () => actor.send({ type: "UPDATE" }),
				finalize: () => actor.send({ type: "FINAL" }),
			}),
		});
		const ghostCommit = vi.fn();

		expect(() =>
			core(createProjectionDocumentTarget({ commitDocument: ghostCommit })),
		).toThrow("[XStateAdapter] Snapshot context must be an own data property.");

		if (!capturedSnapshot || !capturedContextDescriptor) {
			return;
		}
		Object.defineProperty(
			capturedSnapshot,
			"context",
			capturedContextDescriptor,
		);
		await core.execute("recover");
		await flushMicrotasks();
		await flushMicrotasks();
		expect(ghostCommit).not.toHaveBeenCalled();

		const commitDocument = vi.fn();
		const session = core(createProjectionDocumentTarget({ commitDocument }));
		await flushMicrotasks();
		expect(commitDocument).toHaveBeenCalledTimes(1);
		await core.execute("update");
		await vi.waitFor(() => {
			expect(commitDocument).toHaveBeenCalledTimes(2);
		});

		session.dispose();
		await core.execute("finalize");
		await flushMicrotasks();
		expect(commitDocument).toHaveBeenCalledTimes(2);
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
		const target = createProjectionDocumentTarget({
			commitDocument: () => undefined,
		});
		const clonedTarget = {};
		Object.defineProperties(
			clonedTarget,
			Object.getOwnPropertyDescriptors(target),
		);

		expect(() => core("div" as never)).toThrow(
			"[igniteElementFactory] The one-argument overload only accepts first-party projection targets.",
		);
		expect(() => core({ kind: "document" } as never)).toThrow(
			"[igniteElementFactory] The one-argument overload only accepts first-party projection targets.",
		);
		expect(() => Reflect.apply(core, undefined, [clonedTarget])).toThrow(
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
