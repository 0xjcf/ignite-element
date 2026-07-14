import { igniteTools, isOk, type NeutralManifest } from "ignite-element/tools";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	auditCompletionEvidence,
	type ModelExchange,
	type ModelRequest,
	type ModelResult,
	modelTools,
	modelTurn,
} from "./agent-loop";
import { component, source } from "./session";

const nodes = [
	{
		kind: "checklist",
		id: "plan-items",
		items: [{ id: "draft", label: "Draft", checked: false }],
	},
] as const;

const priceEvidenceHistory: ModelExchange[] = [
	{
		calls: [
			{
				id: "search-prices",
				command: "searchWeb",
				input: {
					queries: [
						{ subject: "Bread", query: "bread price" },
						{ subject: "Butter", query: "butter price" },
					],
				},
			},
		],
		results: [
			{
				id: "search-prices",
				command: "searchWeb",
				status: "capability-success",
				fact: {
					searches: [
						{
							subject: "Bread",
							query: "bread price",
							price: {
								status: "sourced",
								amount: 4.49,
								display: "$4.49",
								sourceUrl: "https://example.com/bread",
							},
							results: [],
						},
						{
							subject: "Butter",
							query: "butter price",
							price: {
								status: "unverified",
								amount: null,
								sourceUrl: "https://example.com/butter",
								reason:
									"No single explicit price was found in the returned sources.",
							},
							results: [],
						},
					],
				},
				view: { artifacts: [] },
				events: [],
			},
		],
	},
];

beforeAll(() => component.execute({ command: "reportModelAvailable" }));
afterAll(() => source.stop());

const executeModelTurn = async (response: ModelResult) => {
	const tools = igniteTools(component);
	const protocol = modelTurn(response);
	let step = protocol.next();
	while (!step.done) {
		const call = step.value;
		const execution = await tools.run({
			name: call.command,
			input: call.input,
		});
		const rejectedByActor = isOk(execution)
			? execution.value.events.find(
					(actorEvent) => actorEvent.type === "artifact-rejected",
				)
			: undefined;
		step = protocol.next({
			id: call.id ?? "test-call",
			command: call.command,
			status: !isOk(execution)
				? "tool-error"
				: rejectedByActor
					? "actor-rejected"
					: "accepted",
			...(!isOk(execution)
				? {
						reason: execution.error.kind,
						...(execution.error.kind === "InvalidInput"
							? { issues: execution.error.issues }
							: {}),
					}
				: rejectedByActor && "reason" in rejectedByActor
					? {
							reason: String(rejectedByActor.reason),
							...(rejectedByActor.issues
								? { issues: rejectedByActor.issues }
								: {}),
						}
					: {}),
			view: component.getView().modelContext,
			events: isOk(execution)
				? execution.value.events.map((actorEvent) => ({
						type: actorEvent.type,
						...("reason" in actorEvent
							? { reason: String(actorEvent.reason) }
							: {}),
					}))
				: [],
		});
	}
	return step.value;
};

describe("voice/text workbench model turn", () => {
	it("keeps an explicitly admitted external capability in the model manifest", () => {
		const manifest: NeutralManifest = [
			{
				name: "createArtifact",
				inputSchema: { type: "object", properties: {} },
				gated: false,
			},
			{
				name: "searchWeb",
				inputSchema: { type: "object", properties: {} },
				gated: false,
			},
		];

		expect(
			modelTools(manifest, ["searchWeb"]).map((tool) => tool.name),
		).toEqual(["createArtifact", "searchWeb"]);
	});

	it("audits accepted semantic evidence without treating checklist labels as data", () => {
		const audit = auditCompletionEvidence(priceEvidenceHistory, {
			activeArtifactId: "shopping",
			artifacts: [
				{
					id: "shopping",
					nodes: [
						{
							id: "items",
							kind: "checklist",
							items: [
								{ id: "bread", label: "Bread · $4.49", checked: false },
								{ id: "butter", label: "Butter", checked: false },
							],
						},
						{
							id: "prices",
							kind: "table",
							columns: [
								{ id: "subject", label: "Subject" },
								{ id: "price", label: "Price" },
							],
							rows: [{ id: "bread", cells: ["Bread", 4.99] }],
						},
						{
							id: "fabricated-savings",
							kind: "chart",
							chartType: "bar",
							series: [{ id: "savings", label: "Projected savings", value: 5 }],
						},
					],
				},
			],
		});

		expect(audit).toMatchObject({
			ok: false,
			issues: expect.arrayContaining([
				expect.stringContaining("checklist labels"),
				expect.stringContaining("Subject, Price, Status, and Source"),
				expect.stringContaining("Projected savings"),
			]),
		});
	});

	it("accepts exact sourced table facts and excludes unverified chart values", () => {
		expect(
			auditCompletionEvidence(priceEvidenceHistory, {
				activeArtifactId: "shopping",
				artifacts: [
					{
						id: "shopping",
						nodes: [
							{
								id: "items",
								kind: "checklist",
								items: [
									{ id: "bread", label: "Bread", checked: false },
									{ id: "butter", label: "Butter", checked: false },
								],
							},
							{
								id: "prices",
								kind: "table",
								columns: [
									{ id: "subject", label: "Subject" },
									{ id: "price", label: "Price" },
									{ id: "status", label: "Status" },
									{ id: "source", label: "Source" },
								],
								rows: [
									{
										id: "bread",
										cells: [
											"Bread",
											4.49,
											"sourced",
											"https://example.com/bread",
										],
									},
									{
										id: "butter",
										cells: [
											"Butter",
											null,
											"unverified",
											"https://example.com/butter",
										],
									},
								],
							},
							{
								id: "spending",
								kind: "chart",
								chartType: "bar",
								series: [{ id: "bread", label: "Bread", value: 4.49 }],
							},
						],
					},
				],
			}),
		).toEqual({ ok: true });
	});

	it("returns an external capability fact to the next model round without mutating the actor", () => {
		const protocol = modelTurn({
			ok: true,
			calls: [
				{
					id: "search-prices",
					command: "searchWeb",
					input: { queries: ["typical grocery prices"] },
				},
			],
		});

		expect(protocol.next()).toMatchObject({
			done: false,
			value: { command: "searchWeb" },
		});
		expect(
			protocol.next({
				id: "search-prices",
				command: "searchWeb",
				ownerId: "web-search",
				status: "capability-success",
				fact: {
					searches: [
						{
							query: "typical grocery prices",
							results: [{ title: "Grocer", url: "https://example.com" }],
						},
					],
				},
				receipt: {
					provider: "brave-web-search",
					queryCount: 1,
					sourceCount: 1,
				},
				view: { artifacts: [] },
				events: [],
			}),
		).toMatchObject({
			done: true,
			value: {
				accepted: false,
				reason: "response-incomplete",
				trace: [{ command: "searchWeb", accepted: true }],
				exchange: {
					results: [
						expect.objectContaining({
							status: "capability-success",
							ownerId: "web-search",
						}),
					],
				},
			},
		});
	});

	it("observes external evidence before a sibling artifact mutation", () => {
		const protocol = modelTurn({
			ok: true,
			calls: [
				{
					id: "search-prices",
					command: "searchWeb",
					input: { queries: ["bread price"] },
				},
				{
					id: "create-budget",
					command: "createArtifact",
					input: { id: "budget", nodes },
				},
			],
		});

		expect(protocol.next()).toMatchObject({
			done: false,
			value: { id: "search-prices", command: "searchWeb" },
		});
		expect(
			protocol.next({
				id: "search-prices",
				command: "searchWeb",
				ownerId: "web-search",
				status: "capability-success",
				fact: {
					searches: [
						{
							query: "bread price",
							results: [{ url: "https://example.com/bread" }],
						},
					],
				},
				receipt: {
					provider: "brave-web-search",
					queryCount: 1,
					sourceCount: 1,
				},
				view: { artifacts: [] },
				events: [],
			}),
		).toMatchObject({
			done: true,
			value: {
				accepted: false,
				reason: "response-incomplete",
				trace: [{ command: "searchWeb", accepted: true }],
				exchange: {
					results: [
						expect.objectContaining({
							id: "search-prices",
							status: "capability-success",
						}),
						expect.objectContaining({
							id: "create-budget",
							status: "deferred",
							reason: "observe-tool-result-before-continuing",
						}),
					],
				},
			},
		});
	});

	it("returns every model call to the next round and defers completion until a mutation is observed", () => {
		const protocol = modelTurn({
			ok: true,
			calls: [
				{
					id: "create-plan",
					command: "createArtifact",
					input: { id: "plan", nodes },
				},
				{
					id: "complete-plan",
					command: "completeResponse",
					input: { text: "Plan ready." },
				},
			],
		});

		expect(protocol.next()).toMatchObject({
			done: false,
			value: { id: "create-plan", command: "createArtifact" },
		});
		expect(
			protocol.next({
				id: "create-plan",
				command: "createArtifact",
				status: "accepted",
				view: { artifacts: [{ id: "plan", revision: "1" }] },
				events: [{ type: "artifact-created" }],
			}),
		).toEqual({
			done: true,
			value: {
				accepted: false,
				reason: "response-incomplete",
				trace: [{ command: "createArtifact", accepted: true }],
				exchange: {
					calls: [
						expect.objectContaining({ id: "create-plan" }),
						expect.objectContaining({ id: "complete-plan" }),
					],
					results: [
						expect.objectContaining({
							id: "create-plan",
							status: "accepted",
						}),
						expect.objectContaining({
							id: "complete-plan",
							status: "deferred",
						}),
					],
				},
			},
		});
	});

	it("admits at most one artifact mutation per model response", () => {
		const input = { id: "plan", nodes };
		const protocol = modelTurn({
			ok: true,
			calls: [
				{ command: "createArtifact", input },
				{ command: "createArtifact", input },
			],
		});

		expect(protocol.next()).toMatchObject({
			done: false,
			value: { command: "createArtifact" },
		});
		expect(
			protocol.next({
				id: "model-call-0",
				command: "createArtifact",
				status: "accepted",
				view: { artifacts: [{ id: "plan", revision: "1" }] },
				events: [{ type: "artifact-created" }],
			}),
		).toMatchObject({
			done: true,
			value: {
				accepted: false,
				reason: "response-incomplete",
				trace: [{ command: "createArtifact", accepted: true }],
				exchange: {
					results: [
						expect.objectContaining({ status: "accepted" }),
						expect.objectContaining({ status: "deferred" }),
					],
				},
			},
		});
	});

	it("treats an authorized checklist item update as an observable mutation", () => {
		const protocol = modelTurn({
			ok: true,
			calls: [
				{
					id: "check-item",
					command: "setChecklistItem",
					input: {
						artifactId: "plan",
						expectedRevision: "1",
						nodeId: "plan-items",
						itemId: "draft",
						checked: true,
					},
				},
				{
					id: "complete-item",
					command: "completeResponse",
					input: { text: "Draft checked." },
				},
			],
		});

		expect(protocol.next()).toMatchObject({
			done: false,
			value: { id: "check-item", command: "setChecklistItem" },
		});
		expect(
			protocol.next({
				id: "check-item",
				command: "setChecklistItem",
				status: "accepted",
				view: { artifacts: [{ id: "plan", revision: "2" }] },
				events: [{ type: "artifact-revised" }],
			}),
		).toMatchObject({
			done: true,
			value: {
				accepted: false,
				reason: "response-incomplete",
				trace: [{ command: "setChecklistItem", accepted: true }],
				exchange: {
					results: [
						expect.objectContaining({
							id: "check-item",
							status: "accepted",
						}),
						expect.objectContaining({
							id: "complete-item",
							status: "deferred",
							reason: "observe-artifact-mutation-before-continuing",
						}),
					],
				},
			},
		});
	});

	it("uses direct component tools across allowed and rejected turns", async () => {
		const requests: ModelRequest[] = [];
		const request = (prompt: ModelRequest["prompt"]): ModelRequest => {
			const tools = igniteTools(component);
			const modelRequest = {
				prompt,
				tools: modelTools(tools.manifest),
				view: component.getView().modelContext,
				history: [],
				capabilities: { internetAccess: "unavailable" as const },
			};
			requests.push(modelRequest);
			return modelRequest;
		};
		const firstPrompt = { channel: "text" as const, text: "Make a plan" };
		await component.execute({
			command: "submitPrompt",
			input: { modality: firstPrompt.channel, text: firstPrompt.text },
		});
		request(firstPrompt);
		const created = await executeModelTurn({
			ok: true,
			calls: [
				{
					command: "createArtifact",
					input: { id: "plan", title: "Plan", nodes },
				},
			],
		});
		expect(created).toMatchObject({
			accepted: false,
			reason: "response-incomplete",
		});
		request(firstPrompt);
		const completed = await executeModelTurn({
			ok: true,
			calls: [
				{
					command: "completeResponse",
					input: { text: "Plan ready.", speech: "Plan ready." },
				},
			],
		});
		expect(completed.accepted).toBe(true);

		const secondPrompt = { channel: "speech" as const, text: "Revise it" };
		await component.execute({
			command: "submitPrompt",
			input: { modality: secondPrompt.channel, text: secondPrompt.text },
		});
		request(secondPrompt);
		const revised = await executeModelTurn({
			ok: true,
			calls: [
				{
					command: "reviseArtifact",
					input: {
						artifactId: "plan",
						expectedRevision: "1",
						nodes: [
							{
								kind: "checklist",
								id: "plan-items",
								items: [{ id: "draft", label: "Draft", checked: true }],
							},
						],
					},
				},
			],
		});
		expect(revised).toMatchObject({
			accepted: false,
			reason: "response-incomplete",
		});
		request(secondPrompt);
		await expect(
			executeModelTurn({
				ok: true,
				calls: [
					{
						command: "completeResponse",
						input: { text: "Plan revised." },
					},
				],
			}),
		).resolves.toMatchObject({ accepted: true });

		expect(requests[0]?.tools.map((tool) => tool.name)).toEqual([
			"createArtifact",
		]);
		expect(requests[1]?.tools.map((tool) => tool.name)).toEqual([
			"completeResponse",
			"createArtifact",
			"reviseArtifact",
			"setChecklistItem",
		]);
		expect(
			requests.flatMap((request) => request.tools.map((tool) => tool.name)),
		).not.toContain("acknowledgeSpeech");
		expect(component.getView()).toMatchObject({
			status: "ready",
			artifacts: [{ id: "plan", revision: "2" }],
		});
	});

	it("returns command validation issues to the model as structured feedback", async () => {
		await component.execute({
			command: "submitPrompt",
			input: { modality: "text", text: "Create a checklist" },
		});
		const rejected = await executeModelTurn({
			ok: true,
			calls: [
				{
					id: "invalid-checklist",
					command: "createArtifact",
					input: {
						id: "checklist",
						nodes: [{ id: "items", kind: "checklist", items: [] }],
					},
				},
			],
		});

		expect(rejected).toMatchObject({
			accepted: false,
			reason: "command-rejected",
			command: "createArtifact",
			exchange: {
				results: [
					{
						id: "invalid-checklist",
						command: "createArtifact",
						status: "tool-error",
						reason: "InvalidInput",
						issues: ["input.nodes[0].items: fewer than minItems 1"],
						events: [],
					},
				],
			},
		});
		await component.execute({
			command: "completeResponse",
			input: { text: "Validation feedback captured." },
		});
	});

	it("recovers provider failure facts to ready with a sanitized visible error", async () => {
		await component.execute({
			command: "submitPrompt",
			input: { modality: "text", text: "Create a decision log" },
		});
		const failed = await executeModelTurn({
			ok: false,
			error: {
				kind: "network",
				message: "secret provider address and stack",
			},
		});

		expect(failed).toEqual({
			accepted: false,
			reason: "model-failed",
			failure: {
				kind: "network",
				message:
					"The local model could not be reached. Check its configuration and try again.",
			},
			trace: [{ command: "completeResponse", accepted: true }],
		});
		expect(component.getView()).toMatchObject({
			status: "ready",
			response: {
				text: "The local model could not be reached. Check its configuration and try again.",
			},
		});
	});

	it("normalizes provider failure facts through the same recovery path", async () => {
		await component.execute({
			command: "submitPrompt",
			input: { modality: "speech", text: "Revise the artifact" },
		});
		const failed = await executeModelTurn({
			ok: false,
			error: { kind: "provider", message: "secret provider failure" },
		});

		expect(failed).toMatchObject({
			accepted: false,
			reason: "model-failed",
			failure: {
				kind: "provider",
				message: "The local model could not complete this turn. Try again.",
			},
		});
		expect(component.getView()).toMatchObject({ status: "ready" });
	});

	it("leaves an incomplete admitted turn open for a completion round", async () => {
		await component.execute({
			command: "submitPrompt",
			input: { modality: "text", text: "Create without completing" },
		});
		const incomplete = await executeModelTurn({
			ok: true,
			calls: [
				{
					command: "createArtifact",
					input: {
						id: "incomplete-turn",
						title: "Incomplete turn",
						nodes,
					},
				},
			],
		});

		expect(incomplete).toMatchObject({
			accepted: false,
			reason: "response-incomplete",
			trace: [{ command: "createArtifact", accepted: true }],
		});
		expect(component.getView()).toMatchObject({
			status: "responding",
			response: null,
		});
		await component.execute({
			command: "completeResponse",
			input: { text: "Follow-up round complete." },
		});
	});

	it("does not publish a prompt event when submitPrompt is not admitted", async () => {
		await component.execute({
			command: "submitPrompt",
			input: { modality: "text", text: "Keep this turn active" },
		});
		const beforeRejectedPrompt = component.getView();
		const promptSubmitted = vi.fn();
		const subscription = component.on("prompt-submitted", promptSubmitted);

		await component.execute({
			command: "submitPrompt",
			input: { modality: "speech", text: "Do not admit this prompt" },
		});

		expect(promptSubmitted).not.toHaveBeenCalled();
		expect(component.getView()).toEqual(beforeRejectedPrompt);
		subscription.unsubscribe();

		await component.execute({
			command: "completeResponse",
			input: { text: "Active turn completed after rejection proof." },
		});
	});
});
