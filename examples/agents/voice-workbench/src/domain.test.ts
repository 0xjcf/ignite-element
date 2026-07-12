import { describe, expect, it } from "vitest";

const loadDomain = async () => {
	const domain = await import("./domain").catch(() => null);
	expect(
		domain,
		"the voice workbench domain core has not been implemented",
	).not.toBeNull();
	return domain as NonNullable<typeof domain>;
};

describe("voice workbench domain", () => {
	it("creates and revises an artifact through immutable aggregate transitions", async () => {
		const { createInitialSession, reduceConversationSession } =
			await loadDomain();
		const initial = createInitialSession("session-1");
		const created = reduceConversationSession(initial, {
			type: "CREATE_ARTIFACT",
			input: {
				id: "launch-plan",
				title: "Launch plan",
				kind: "checklist",
				nodes: [
					{ type: "checklist", items: [{ text: "Ship", checked: false }] },
				],
			},
		});

		expect(created.accepted).toBe(true);
		expect(created.session).not.toBe(initial);
		expect(created.session.artifacts[0]).toMatchObject({
			id: "launch-plan",
			revision: 1,
		});

		const revised = reduceConversationSession(created.session, {
			type: "REVISE_ARTIFACT",
			input: {
				artifactId: "launch-plan",
				expectedRevision: 1,
				nodes: [
					{ type: "checklist", items: [{ text: "Ship", checked: true }] },
				],
			},
		});
		expect(revised.accepted).toBe(true);
		expect(revised.session.artifacts[0]?.revision).toBe(2);
		expect(created.session.artifacts[0]?.revision).toBe(1);
	});

	it("returns conflict and validation facts without mutating state", async () => {
		const { createInitialSession, reduceConversationSession } =
			await loadDomain();
		const initial = createInitialSession("session-1");
		const invalid = reduceConversationSession(initial, {
			type: "CREATE_ARTIFACT",
			input: { id: "", title: "", kind: "table", nodes: [] },
		});
		expect(invalid).toMatchObject({
			accepted: false,
			reason: "validation",
			session: initial,
		});

		const missing = reduceConversationSession(initial, {
			type: "REVISE_ARTIFACT",
			input: { artifactId: "missing", expectedRevision: 4, nodes: [] },
		});
		expect(missing).toMatchObject({
			accepted: false,
			reason: "conflict",
			session: initial,
		});
	});

	it("admits the complete semantic artifact vocabulary", async () => {
		const { ARTIFACT_KINDS } = await loadDomain();
		expect(ARTIFACT_KINDS).toEqual([
			"text",
			"markdown",
			"checklist",
			"form",
			"table",
			"timeline",
			"decision-log",
			"code-diff",
			"command-action",
		]);
	});
});
