import { describe, expect, it } from "vitest";
import { createInitialSession, reduceConversationSession } from "./domain";

const checklist = [
	{
		kind: "checklist",
		id: "launch-items",
		items: [{ id: "ship", label: "Ship", checked: false }],
	},
] as const;

const allSemanticNodes = [
	{ kind: "text", id: "summary", text: "Release readiness" },
	{
		kind: "checklist",
		id: "checks",
		items: [{ id: "schema", label: "Schema complete", checked: true }],
	},
	{
		kind: "action",
		id: "complete",
		label: "Complete response",
		commandName: "completeResponse",
		payload: { text: "Complete.", speech: "Complete." },
		description: "Finish the current turn",
	},
	{
		kind: "form",
		id: "owner-form",
		title: "Owner",
		fields: [
			{
				id: "owner",
				label: "Owner",
				input: { type: "string", minLength: 1 },
				value: "Runtime",
				description: "Accountable team",
			},
		],
		submit: {
			kind: "action",
			id: "submit-owner",
			label: "Save owner",
			commandName: "completeResponse",
			payload: { text: "Owner saved." },
		},
	},
	{
		kind: "table",
		id: "risks",
		columns: [
			{ id: "risk", label: "Risk" },
			{ id: "score", label: "Score" },
		],
		rows: [{ id: "provider", cells: ["Provider unavailable", 2] }],
	},
	{
		kind: "timeline",
		id: "timeline",
		events: [
			{
				id: "freeze",
				label: "API freeze",
				timestamp: "2026-07-20",
				detail: "Stabilize the public contract",
			},
		],
	},
	{
		kind: "chart",
		id: "progress",
		chartType: "bar",
		series: [{ id: "ready", label: "Ready", value: 72 }],
	},
	{
		kind: "code-diff",
		id: "diff",
		language: "ts",
		before: "phase",
		after: "status",
	},
	{
		kind: "decision-log",
		id: "decisions",
		entries: [
			{
				id: "local",
				title: "Provider",
				decision: "Use local MLX",
				rationale: "Keep the live path consumer-owned",
			},
		],
	},
] as const;

describe("voice workbench domain", () => {
	it("accepts every renderer-supported semantic node shape", () => {
		const initial = createInitialSession("session-semantic");
		const created = reduceConversationSession(initial, {
			type: "CREATE_ARTIFACT",
			input: {
				id: "release-readiness",
				title: "Release readiness",
				nodes: allSemanticNodes,
			},
		});

		expect(created).toMatchObject({
			accepted: true,
			session: {
				documents: [
					{
						id: "release-readiness",
						nodes: allSemanticNodes,
					},
				],
			},
		});
	});

	it("accepts the projection contract's optional artifact title", () => {
		const created = reduceConversationSession(
			createInitialSession("untitled"),
			{
				type: "CREATE_ARTIFACT",
				input: {
					id: "decision-log",
					nodes: [allSemanticNodes[8]],
				},
			},
		);

		expect(created).toMatchObject({
			accepted: true,
			session: {
				documents: [{ id: "decision-log", revision: "1" }],
			},
		});
	});

	it.each(
		[
			[{ kind: "text", id: "text" }],
			[{ kind: "checklist", id: "checks", items: [{ id: "x" }] }],
			[{ kind: "action", id: "action", label: "Run", commandName: "eval" }],
			[{ kind: "form", id: "form", fields: [{ id: "field", label: "X" }] }],
			[
				{
					kind: "table",
					id: "table",
					columns: [{ id: "a", label: "A" }],
					rows: [{ id: "row", cells: "not-an-array" }],
				},
			],
			[{ kind: "timeline", id: "timeline", events: [{ id: "x", label: "X" }] }],
			[
				{
					kind: "chart",
					id: "chart",
					chartType: "radar",
					series: [{ id: "x", label: "X", value: "high" }],
				},
			],
			[{ kind: "code-diff", id: "diff", before: 42 }],
			[
				{
					kind: "decision-log",
					id: "decisions",
					entries: [{ id: "x", title: "X" }],
				},
			],
			[{ kind: "iframe", id: "unsafe", src: "javascript:alert(1)" }],
			[
				{ kind: "text", id: "duplicate", text: "One" },
				{ kind: "text", id: "duplicate", text: "Two" },
			],
		].map((nodes) => [nodes]),
	)(
		"rejects malformed untrusted semantic nodes without storing them",
		(nodes) => {
			const initial = createInitialSession("session-invalid");
			let result: ReturnType<typeof reduceConversationSession> | undefined;
			expect(() => {
				result = reduceConversationSession(initial, {
					type: "CREATE_ARTIFACT",
					input: {
						id: "unsafe",
						title: "Unsafe",
						nodes: nodes as never,
					},
				});
			}).not.toThrow();
			expect(result).toEqual({
				accepted: false,
				reason: "validation",
				session: initial,
			});
			expect(initial.documents).toEqual([]);
		},
	);

	it("returns an actionable issue for an empty checklist", () => {
		const initial = createInitialSession("session-empty-checklist");

		expect(
			reduceConversationSession(initial, {
				type: "CREATE_ARTIFACT",
				input: {
					id: "checklist",
					nodes: [{ kind: "checklist", id: "checks", items: [] }],
				},
			}),
		).toEqual({
			accepted: false,
			reason: "validation",
			issues: [
				"Checklist nodes require at least one item with a unique id, non-empty label, and boolean checked value.",
			],
			session: initial,
		});
	});

	it("stores standard Ignite projection documents with string revisions", () => {
		const initial = createInitialSession("session-1");
		expect(initial).toMatchObject({
			documents: [],
			artifactRevisions: [],
			speech: null,
		});
		const submitted = reduceConversationSession(initial, {
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: "Create a launch plan" },
		});
		expect(submitted).toMatchObject({ accepted: true });
		if (!submitted?.accepted) return;

		const created = reduceConversationSession(submitted.session, {
			type: "CREATE_ARTIFACT",
			input: { id: "launch-plan", title: "Launch plan", nodes: checklist },
		});
		expect(created).toMatchObject({
			accepted: true,
			session: {
				documents: [
					{
						id: "launch-plan",
						title: "Launch plan",
						revision: "1",
						nodes: checklist,
					},
				],
				artifactRevisions: [
					{
						id: "launch-plan",
						title: "Launch plan",
						revision: "1",
						nodes: checklist,
					},
				],
			},
		});
		if (!created.accepted) return;

		const revisedNodes = [
			{
				kind: "checklist",
				id: "launch-items",
				items: [{ id: "ship", label: "Ship", checked: true }],
			},
		] as const;
		const revised = reduceConversationSession(created.session, {
			type: "REVISE_ARTIFACT",
			input: {
				artifactId: "launch-plan",
				expectedRevision: "1",
				nodes: revisedNodes,
			},
		});
		expect(revised).toMatchObject({
			accepted: true,
			session: {
				documents: [{ revision: "2", nodes: revisedNodes }],
				artifactRevisions: [
					{ id: "launch-plan", revision: "1", nodes: checklist },
					{ id: "launch-plan", revision: "2", nodes: revisedNodes },
				],
			},
		});
		expect(created.session.documents[0]?.revision).toBe("1");
		expect(created.session.artifactRevisions).toHaveLength(1);
		expect(revised.accepted && revised.session.artifactRevisions[0]).toBe(
			created.session.documents[0],
		);
	});

	it("sets a checklist item through a revision-checked artifact command", () => {
		const created = reduceConversationSession(
			createInitialSession("checklist"),
			{
				type: "CREATE_ARTIFACT",
				input: { id: "launch-plan", nodes: checklist },
			},
		);
		if (!created.accepted) throw new Error("expected artifact creation");

		const checked = reduceConversationSession(created.session, {
			type: "SET_CHECKLIST_ITEM",
			input: {
				artifactId: "launch-plan",
				expectedRevision: "1",
				nodeId: "launch-items",
				itemId: "ship",
				checked: true,
			},
		});

		expect(checked).toMatchObject({
			accepted: true,
			session: {
				documents: [
					{
						id: "launch-plan",
						revision: "2",
						nodes: [
							{
								id: "launch-items",
								items: [{ id: "ship", checked: true }],
							},
						],
					},
				],
				artifactRevisions: [{ revision: "1" }, { revision: "2" }],
			},
		});
		if (!checked.accepted) throw new Error("expected checklist update");

		expect(
			reduceConversationSession(checked.session, {
				type: "SET_CHECKLIST_ITEM",
				input: {
					artifactId: "launch-plan",
					expectedRevision: "1",
					nodeId: "launch-items",
					itemId: "ship",
					checked: false,
				},
			}),
		).toMatchObject({
			accepted: false,
			reason: "conflict",
			session: checked.session,
		});

		expect(
			reduceConversationSession(checked.session, {
				type: "SET_CHECKLIST_ITEM",
				input: {
					artifactId: "launch-plan",
					expectedRevision: "2",
					nodeId: "missing",
					itemId: "ship",
					checked: false,
				},
			}),
		).toMatchObject({
			accepted: false,
			reason: "validation",
			session: checked.session,
		});
	});

	it("keeps multiple artifacts and changes the active artifact explicitly", () => {
		const first = reduceConversationSession(createInitialSession("workspace"), {
			type: "CREATE_ARTIFACT",
			input: { id: "shopping-list", title: "Shopping list", nodes: checklist },
		});
		if (!first.accepted) throw new Error("expected first artifact creation");
		const second = reduceConversationSession(first.session, {
			type: "CREATE_ARTIFACT",
			input: {
				id: "budget",
				title: "Budget",
				nodes: [allSemanticNodes[4], allSemanticNodes[6]],
			},
		});
		if (!second.accepted) throw new Error("expected second artifact creation");

		expect(second.session).toMatchObject({
			activeArtifactId: "budget",
			documents: [
				{ id: "shopping-list", revision: "1" },
				{ id: "budget", revision: "1" },
			],
		});

		const selected = reduceConversationSession(second.session, {
			type: "SELECT_ARTIFACT",
			input: { artifactId: "shopping-list" },
		});
		expect(selected).toMatchObject({
			accepted: true,
			session: {
				activeArtifactId: "shopping-list",
				lastFact: {
					type: "artifact-selected",
					artifactId: "shopping-list",
				},
			},
		});
		expect(
			reduceConversationSession(second.session, {
				type: "SELECT_ARTIFACT",
				input: { artifactId: "missing" },
			}),
		).toMatchObject({ accepted: false, reason: "validation" });
	});

	it("restores a historical snapshot by appending a new forward revision", () => {
		const created = reduceConversationSession(createInitialSession("history"), {
			type: "CREATE_ARTIFACT",
			input: { id: "launch-plan", title: "Launch plan", nodes: checklist },
		});
		if (!created.accepted) throw new Error("expected artifact creation");
		const revised = reduceConversationSession(created.session, {
			type: "SET_CHECKLIST_ITEM",
			input: {
				artifactId: "launch-plan",
				expectedRevision: "1",
				nodeId: "launch-items",
				itemId: "ship",
				checked: true,
			},
		});
		if (!revised.accepted) throw new Error("expected artifact revision");

		const restored = reduceConversationSession(revised.session, {
			type: "RESTORE_ARTIFACT_REVISION",
			input: {
				artifactId: "launch-plan",
				expectedRevision: "2",
				revision: "1",
			},
		});

		expect(restored).toMatchObject({
			accepted: true,
			session: {
				documents: [{ id: "launch-plan", revision: "3", nodes: checklist }],
				artifactRevisions: [
					{ revision: "1", nodes: checklist },
					{ revision: "2" },
					{ revision: "3", nodes: checklist },
				],
				lastFact: {
					type: "artifact-restored",
					artifactId: "launch-plan",
					fromRevision: "1",
					revision: "3",
				},
			},
		});
		if (!restored.accepted) throw new Error("expected revision restore");
		expect(revised.session.artifactRevisions).toHaveLength(2);
		expect(
			reduceConversationSession(restored.session, {
				type: "RESTORE_ARTIFACT_REVISION",
				input: {
					artifactId: "launch-plan",
					expectedRevision: "2",
					revision: "1",
				},
			}),
		).toMatchObject({ accepted: false, reason: "conflict" });
		expect(
			reduceConversationSession(restored.session, {
				type: "RESTORE_ARTIFACT_REVISION",
				input: {
					artifactId: "launch-plan",
					expectedRevision: "3",
					revision: "99",
				},
			}),
		).toMatchObject({ accepted: false, reason: "validation" });
	});

	it("returns validation and revision-conflict facts without mutation", () => {
		const initial = createInitialSession("session-1");
		const invalid = reduceConversationSession(initial, {
			type: "CREATE_ARTIFACT",
			input: { id: "", title: "", nodes: [] },
		});
		expect(invalid).toMatchObject({
			accepted: false,
			reason: "validation",
			session: initial,
		});

		const submitted = reduceConversationSession(initial, {
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: "Revise a missing artifact" },
		});
		if (!submitted?.accepted) throw new Error("expected prompt acceptance");
		const missing = reduceConversationSession(submitted.session, {
			type: "REVISE_ARTIFACT",
			input: { artifactId: "missing", expectedRevision: "4", nodes: checklist },
		});
		expect(missing).toMatchObject({
			accepted: false,
			reason: "conflict",
			session: submitted.session,
		});
	});

	it("creates and acknowledges a standard speech request with stale-id safety", () => {
		const initial = createInitialSession("session-1");
		const submitted = reduceConversationSession(initial, {
			type: "SUBMIT_PROMPT",
			input: { modality: "speech", text: "Read the answer" },
		});
		if (!submitted?.accepted) throw new Error("expected prompt acceptance");
		const completed = reduceConversationSession(submitted.session, {
			type: "COMPLETE_RESPONSE",
			input: { text: "Answer ready.", speech: "Answer ready." },
		});
		expect(completed).toMatchObject({
			accepted: true,
			session: {
				speech: {
					id: "response-2",
					text: "Answer ready.",
					status: "pending",
				},
			},
		});
		if (!completed.accepted || !completed.session.speech) return;

		const stale = reduceConversationSession(completed.session, {
			type: "ACKNOWLEDGE_SPEECH",
			input: { id: "stale" },
		});
		expect(stale).toMatchObject({
			accepted: false,
			reason: "conflict",
			session: completed.session,
		});

		const acknowledged = reduceConversationSession(completed.session, {
			type: "ACKNOWLEDGE_SPEECH",
			input: { id: completed.session.speech.id },
		});
		expect(acknowledged).toMatchObject({
			accepted: true,
			session: { speech: { status: "acknowledged" } },
		});
	});
});
