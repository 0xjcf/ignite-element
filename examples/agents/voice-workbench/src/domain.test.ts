import { describe, expect, it } from "vitest";
import { createInitialSession, reduceConversationSession } from "./domain";

const checklist = [
	{
		kind: "checklist",
		id: "launch-items",
		items: [{ id: "ship", label: "Ship", checked: false }],
	},
] as const;

describe("voice workbench domain", () => {
	it("stores standard Ignite projection documents with string revisions", () => {
		const initial = createInitialSession("session-1");
		expect(initial).toMatchObject({
			phase: "ready",
			documents: [],
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
			session: { documents: [{ revision: "2", nodes: revisedNodes }] },
		});
		expect(created.session.documents[0]?.revision).toBe("1");
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
				phase: "ready",
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
