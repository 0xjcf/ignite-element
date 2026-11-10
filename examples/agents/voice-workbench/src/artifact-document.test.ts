// @vitest-environment node

import type { IgniteSchemaValue } from "ignite-element";
import { igniteCore } from "ignite-element/xstate";
import { describe, expect, it, vi } from "vitest";
import { assign, setup } from "xstate";
import {
	applyProjectionDocumentPatch,
	parseProjectionDocument,
	parseProjectionDocumentCollection,
	upsertProjectionDocument,
	validateProjectionDocument,
} from "./artifact-document";
import type {
	ProjectionDocument,
	ProjectionDocumentPatch,
	ProjectionSpeechRequest,
} from "./artifact-types";

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

// Existing explicit schemas belong to this application's validation boundary,
// not the core's unknown runtime-schema discovery catalogue.
const projectionCommandSchema = {
	commands: {
		upsertProjection: { input: { type: "object" } },
		patchProjection: { input: { type: "object" } },
		queueSpeech: { input: { type: "object" } },
		acknowledgeSpeech: {
			input: {
				type: "object",
				properties: { speechId: { type: "string" } },
				required: ["speechId"],
			},
		},
		confirm: {
			input: {
				type: "object",
				properties: { value: { type: "number", minimum: 1 } },
				required: ["value"],
			},
		},
	},
};

function createProjectionCore(onProjectStates: () => void = () => undefined) {
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
		states: (snapshot) => {
			onProjectStates();
			return {
				documentCount: snapshot.context.documents.length,
				speechStatus: snapshot.context.speech?.status ?? "idle",
				commandAvailability: { confirm: snapshot.context.allowConfirm },
			};
		},
		commands: ({ source: actor }) => ({
			upsertProjection: (document: ProjectionDocument) =>
				actor.send({ type: "UPSERT_PROJECTION", document }),
			patchProjection: (patch: ProjectionDocumentPatch) =>
				actor.send({ type: "PATCH_PROJECTION", patch }),
			queueSpeech: (speech: ProjectionSpeechRequest) =>
				actor.send({ type: "QUEUE_SPEECH", speech }),
			acknowledgeSpeech: (payload: { speechId: string }) =>
				actor.send({ type: "ACKNOWLEDGE_SPEECH", speechId: payload.speechId }),
			confirm: (payload: { value: number }) =>
				actor.send({ type: "CONFIRM", payload }),
		}),
	});
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
				schema: projectionCommandSchema,
				canExecute: (name) =>
					name !== "confirm" || core.get("states").commandAvailability.confirm,
			}),
		).toEqual([]);
	});

	it("rejects duplicate nested form submit node ids", () => {
		const core = createProjectionCore();
		expect(
			validateProjectionDocument(
				{
					id: "form-panel",
					revision: "1",
					nodes: [
						{
							kind: "form",
							id: "profile-form",
							fields: [
								{
									id: "name",
									label: "Name",
									input: { type: "string" },
								},
							],
							submit: {
								kind: "action",
								id: "save-profile",
								label: "Save profile",
								commandName: "confirm",
								payload: { value: 1 },
							},
						},
						{
							kind: "action",
							id: "save-profile",
							label: "Save profile again",
							commandName: "confirm",
							payload: { value: 1 },
						},
					],
				},
				{
					schema: projectionCommandSchema,
					canExecute: (name) =>
						name !== "confirm" ||
						core.get("states").commandAvailability.confirm,
				},
			),
		).toContain('nodes[1].id: duplicate node id "save-profile"');
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
						schema: projectionCommandSchema,
						canExecute: (name) =>
							name !== "confirm" ||
							core.get("states").commandAvailability.confirm,
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
						schema: projectionCommandSchema,
						canExecute: (name) =>
							name !== "confirm" ||
							core.get("states").commandAvailability.confirm,
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
						schema: projectionCommandSchema,
						canExecute: (name) =>
							name !== "confirm" ||
							core.get("states").commandAvailability.confirm,
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
						schema: projectionCommandSchema,
						canExecute: (name) =>
							name !== "confirm" ||
							core.get("states").commandAvailability.confirm,
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
					schema: projectionCommandSchema,
					canExecute: (name) =>
						name !== "confirm" ||
						core.get("states").commandAvailability.confirm,
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
					schema: projectionCommandSchema,
					canExecute: (name) =>
						name !== "confirm" ||
						core.get("states").commandAvailability.confirm,
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
					schema: projectionCommandSchema,
					canExecute: (name) =>
						name !== "confirm" ||
						core.get("states").commandAvailability.confirm,
				},
			),
		).toEqual(
			expect.arrayContaining([
				"nodes[0].items[0].id: required",
				"nodes[0].items[0].label: required",
			]),
		);
	});

	it("rejects empty timelines while preserving cumulative issues", () => {
		const core = createProjectionCore();

		expect(
			validateProjectionDocument(
				{
					id: "",
					revision: "",
					nodes: [{ kind: "timeline", id: "", events: [] }],
				},
				{
					schema: projectionCommandSchema,
					canExecute: (name) =>
						name !== "confirm" ||
						core.get("states").commandAvailability.confirm,
				},
			),
		).toEqual([
			"id: required",
			"revision: required",
			"nodes[0].id: required",
			"nodes[0].events: must include at least one event",
		]);
	});

	it("rejects inherited command names through the unknown-command path", () => {
		const core = createProjectionCore();
		const inheritedCommands = Object.create({
			constructor: {},
			toString: {},
		});
		const schema = {
			...core.get("schema"),
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

	it("rejects whitespace-only required identifiers", () => {
		expect(
			parseProjectionDocument({
				id: "   ",
				revision: "\t",
				nodes: [{ kind: "text", id: "\n", text: "Ready" }],
			}),
		).toEqual({
			ok: false,
			issues: ["id: required", "revision: required", "nodes[0].id: required"],
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

	it("rejects malformed patches and missing removal targets without advancing revision", () => {
		const original: ProjectionDocument = {
			id: "panel",
			revision: "1",
			nodes: [
				{ kind: "text", id: "summary", text: "Ready" },
				{ kind: "text", id: "detail", text: "Connected" },
			],
		};

		expect(
			applyProjectionDocumentPatch(original, {
				documentId: "panel",
				baseRevision: "1",
				revision: "2",
				type: "replace-node",
			}),
		).toEqual({
			ok: false,
			code: "invalid-document",
			reason: "Projection patch is invalid: patch.type: unsupported.",
		});
		expect(
			applyProjectionDocumentPatch(original, {
				documentId: "panel",
				baseRevision: "1",
				revision: "2",
				type: "set-node",
				node: { kind: "text", id: "", text: "" },
			}),
		).toEqual({
			ok: false,
			code: "invalid-document",
			reason: "Projection patch is invalid: nodes[0].id: required.",
		});
		expect(
			applyProjectionDocumentPatch(original, {
				documentId: "panel",
				baseRevision: "1",
				revision: "2",
				type: "remove-node",
				nodeId: "missing",
			}),
		).toEqual({
			ok: false,
			code: "invalid-document",
			reason: 'Projection node "missing" does not exist.',
		});
		expect(original.revision).toBe("1");
	});
});
