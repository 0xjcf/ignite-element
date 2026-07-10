// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
	commitProjectionDocumentTarget,
	commitProjectionSpeechTarget,
	createProjectionBindingState,
	createProjectionDocument,
	createProjectionSpeech,
	type ProjectionInspection,
} from "../internal/projectionBinding";

const createInspection = (): ProjectionInspection => ({
	snapshot: {
		context: {
			documents: [
				{
					id: "panel",
					revision: "1",
					nodes: [{ kind: "text", id: "summary", text: "Ready" }],
				},
			],
			speech: {
				id: "speech-1",
				text: "Ready.",
				status: "pending",
			},
		},
	},
	view: {
		documentCount: 1,
		speechStatus: "pending",
	},
	schema: {
		commands: {
			acknowledgeSpeech: {},
		},
		events: [],
		snapshot: null,
		view: null,
	},
	canExecute: () => true,
	revision: "revision-1",
	documents: [
		{
			id: "panel",
			revision: "1",
			nodes: [{ kind: "text", id: "summary", text: "Ready" }],
		},
	],
	speech: {
		id: "speech-1",
		text: "Ready.",
		status: "pending",
	},
});

describe("private projection binding", () => {
	it("returns an unsupported fact instead of throwing when a document committer cannot run", async () => {
		const fact = await commitProjectionDocumentTarget({
			state: createProjectionBindingState(),
			inspection: createInspection(),
			commitDocument: () => ({
				status: "unsupported",
				reason: "document sink unavailable",
			}),
		});

		expect(fact).toEqual({
			channel: "document",
			status: "unsupported",
			documentId: "panel",
			revision: "1",
			reason: "document sink unavailable",
		});
	});

	it("acknowledges speech at most once even when the target is evaluated repeatedly", async () => {
		const state = createProjectionBindingState();
		const acknowledge = vi.fn(async () => undefined);

		await commitProjectionSpeechTarget({
			state,
			inspection: createInspection(),
			commitSpeech: async () => ({ status: "committed" }),
			acknowledge,
		});
		await commitProjectionSpeechTarget({
			state,
			inspection: createInspection(),
			commitSpeech: async () => ({ status: "committed" }),
			acknowledge,
		});

		expect(acknowledge).toHaveBeenCalledTimes(1);
	});

	it("keeps only the latest document revision and current speech identity in binding state", async () => {
		const state = createProjectionBindingState();
		const firstInspection = createInspection();
		const secondInspection: ProjectionInspection = {
			...createInspection(),
			documents: [
				{
					id: "panel",
					revision: "2",
					nodes: [{ kind: "text", id: "summary", text: "Updated" }],
				},
			],
			speech: {
				id: "speech-2",
				text: "Updated.",
				status: "pending",
			},
		};

		await commitProjectionDocumentTarget({
			state,
			inspection: firstInspection,
			projection: createProjectionDocument(),
			commitDocument: () => ({ status: "committed" }),
		});
		await commitProjectionDocumentTarget({
			state,
			inspection: secondInspection,
			projection: createProjectionDocument(),
			commitDocument: () => ({ status: "committed" }),
		});
		await commitProjectionSpeechTarget({
			state,
			inspection: secondInspection,
			projection: createProjectionSpeech(),
			commitSpeech: () => ({ status: "committed" }),
			acknowledge: async () => undefined,
		});

		expect([...state.documentRevisionById.entries()]).toEqual([["panel", "2"]]);
		expect(state.activeSpeechId).toBe("speech-2");
		expect(state.lastAcknowledgedSpeechId).toBe("speech-2");
	});
});
