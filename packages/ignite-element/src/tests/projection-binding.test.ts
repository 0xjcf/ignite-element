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
import type { ProjectionSpeechRequest } from "../types/agent";

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
	it("preserves literal channels on private projection helpers", () => {
		expect(createProjectionDocument().channel).toBe("document");
		expect(createProjectionSpeech().channel).toBe("speech");
	});

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

	it("retries the same document revision after a transient commit error", async () => {
		const state = createProjectionBindingState();
		const inspection = createInspection();
		const commitDocument = vi
			.fn<(_: unknown) => Promise<void>>()
			.mockRejectedValueOnce(new Error("temporary document failure"))
			.mockResolvedValueOnce();

		await expect(
			commitProjectionDocumentTarget({
				state,
				inspection,
				commitDocument,
			}),
		).resolves.toEqual({
			channel: "document",
			status: "error",
			documentId: "panel",
			revision: "1",
			reason: "temporary document failure",
		});
		await expect(
			commitProjectionDocumentTarget({
				state,
				inspection,
				commitDocument,
			}),
		).resolves.toEqual({
			channel: "document",
			status: "committed",
			documentId: "panel",
			revision: "1",
		});
		await expect(
			commitProjectionDocumentTarget({
				state,
				inspection,
				commitDocument,
			}),
		).resolves.toEqual({
			channel: "document",
			status: "skipped",
			reason: "duplicate-document",
		});

		expect(commitDocument).toHaveBeenCalledTimes(2);
	});

	it("retries the same document revision after an unsupported document fact", async () => {
		const state = createProjectionBindingState();
		const inspection = createInspection();
		const commitDocument = vi
			.fn<
				(_: unknown) =>
					| {
							status: "unsupported";
							reason: string;
					  }
					| undefined
			>()
			.mockReturnValueOnce({
				status: "unsupported",
				reason: "document sink unavailable",
			})
			.mockReturnValueOnce(undefined);

		await expect(
			commitProjectionDocumentTarget({
				state,
				inspection,
				commitDocument,
			}),
		).resolves.toEqual({
			channel: "document",
			status: "unsupported",
			documentId: "panel",
			revision: "1",
			reason: "document sink unavailable",
		});
		await expect(
			commitProjectionDocumentTarget({
				state,
				inspection,
				commitDocument,
			}),
		).resolves.toEqual({
			channel: "document",
			status: "committed",
			documentId: "panel",
			revision: "1",
		});
	});

	it("acknowledges speech at most once even when the target is evaluated repeatedly", async () => {
		const state = createProjectionBindingState();
		const commitSpeech = vi.fn<
			(_: unknown) => Promise<{ status: "committed" }>
		>(async () => ({ status: "committed" }));
		const acknowledge = vi.fn(async () => undefined);

		await commitProjectionSpeechTarget({
			state,
			inspection: createInspection(),
			commitSpeech,
			acknowledge,
		});
		await commitProjectionSpeechTarget({
			state,
			inspection: createInspection(),
			commitSpeech,
			acknowledge,
		});

		expect(commitSpeech).toHaveBeenCalledTimes(1);
		expect(acknowledge).toHaveBeenCalledTimes(1);
	});

	it("retries speech delivery after a transient commit failure", async () => {
		const state = createProjectionBindingState();
		const commitSpeech = vi
			.fn<(_: unknown) => Promise<void>>()
			.mockRejectedValueOnce(new Error("temporary delivery failure"))
			.mockResolvedValue(undefined);
		const acknowledge = vi.fn(async () => undefined);

		await expect(
			commitProjectionSpeechTarget({
				state,
				inspection: createInspection(),
				commitSpeech,
				acknowledge,
			}),
		).resolves.toEqual({
			channel: "speech",
			status: "error",
			speechId: "speech-1",
			reason: "temporary delivery failure",
		});
		await expect(
			commitProjectionSpeechTarget({
				state,
				inspection: createInspection(),
				commitSpeech,
				acknowledge,
			}),
		).resolves.toEqual({
			channel: "speech",
			status: "committed",
			speechId: "speech-1",
		});

		expect(commitSpeech).toHaveBeenCalledTimes(2);
		expect(acknowledge).toHaveBeenCalledTimes(1);
	});

	it("retries only acknowledgement after delivery succeeds once", async () => {
		const state = createProjectionBindingState();
		const commitSpeech = vi
			.fn<(_: unknown) => Promise<void>>()
			.mockResolvedValue(undefined);
		const acknowledge = vi
			.fn<(_: unknown) => Promise<void>>()
			.mockRejectedValueOnce(new Error("temporary speech failure"))
			.mockResolvedValueOnce(undefined);

		await expect(
			commitProjectionSpeechTarget({
				state,
				inspection: createInspection(),
				commitSpeech,
				acknowledge,
			}),
		).resolves.toEqual({
			channel: "speech",
			status: "error",
			speechId: "speech-1",
			reason: "temporary speech failure",
		});
		await expect(
			commitProjectionSpeechTarget({
				state,
				inspection: createInspection(),
				commitSpeech,
				acknowledge,
			}),
		).resolves.toEqual({
			channel: "speech",
			status: "committed",
			speechId: "speech-1",
		});
		await expect(
			commitProjectionSpeechTarget({
				state,
				inspection: createInspection(),
				commitSpeech,
				acknowledge,
			}),
		).resolves.toEqual({
			channel: "speech",
			status: "skipped",
			reason: "duplicate-speech",
		});

		expect(commitSpeech).toHaveBeenCalledTimes(1);
		expect(acknowledge).toHaveBeenCalledTimes(2);
	});

	it("releases a custom speech identity after unsupported and failed delivery attempts", async () => {
		const state = createProjectionBindingState();
		const inspection = createInspection();
		const identity = vi.fn(
			(speech: ProjectionSpeechRequest): string => `delivery:${speech.id}`,
		);
		const projection: {
			channel: "speech";
			select(current: ProjectionInspection): ProjectionSpeechRequest | null;
			identity(speech: ProjectionSpeechRequest): string;
		} = {
			channel: "speech",
			select: (current) => current.speech,
			identity,
		};
		const commitSpeech = vi
			.fn<
				(_: ProjectionSpeechRequest) => Promise<
					| {
							status: "unsupported";
							reason: string;
					  }
					| undefined
				>
			>()
			.mockResolvedValueOnce({
				status: "unsupported",
				reason: "speech sink unavailable",
			})
			.mockRejectedValueOnce(new Error("temporary delivery failure"))
			.mockResolvedValueOnce(undefined);
		const acknowledge = vi.fn(async () => undefined);

		await expect(
			commitProjectionSpeechTarget({
				state,
				inspection,
				projection,
				commitSpeech,
				acknowledge,
			}),
		).resolves.toEqual({
			channel: "speech",
			status: "unsupported",
			speechId: "speech-1",
			reason: "speech sink unavailable",
		});
		await expect(
			commitProjectionSpeechTarget({
				state,
				inspection,
				projection,
				commitSpeech,
				acknowledge,
			}),
		).resolves.toEqual({
			channel: "speech",
			status: "error",
			speechId: "speech-1",
			reason: "temporary delivery failure",
		});
		await expect(
			commitProjectionSpeechTarget({
				state,
				inspection,
				projection,
				commitSpeech,
				acknowledge,
			}),
		).resolves.toEqual({
			channel: "speech",
			status: "committed",
			speechId: "speech-1",
		});
		await expect(
			commitProjectionSpeechTarget({
				state,
				inspection,
				projection,
				commitSpeech,
				acknowledge,
			}),
		).resolves.toEqual({
			channel: "speech",
			status: "skipped",
			reason: "duplicate-speech",
		});

		expect(commitSpeech).toHaveBeenCalledTimes(3);
		expect(acknowledge).toHaveBeenCalledTimes(1);
		expect(identity).toHaveBeenCalledTimes(4);
		expect(state.activeSpeechId).toBe(null);
		expect(state.lastAcknowledgedSpeechId).toBe("delivery:speech-1");
	});

	it("retries only acknowledgement when a custom speech identity was delivered", async () => {
		const state = createProjectionBindingState();
		const inspection = createInspection();
		const identity = vi.fn(
			(speech: ProjectionSpeechRequest): string => `delivery:${speech.id}`,
		);
		const projection: {
			channel: "speech";
			select(current: ProjectionInspection): ProjectionSpeechRequest | null;
			identity(speech: ProjectionSpeechRequest): string;
		} = {
			channel: "speech",
			select: (current) => current.speech,
			identity,
		};
		const commitSpeech = vi.fn(
			async (_speech: ProjectionSpeechRequest): Promise<void> => undefined,
		);
		const acknowledge = vi
			.fn<(_: ProjectionSpeechRequest) => Promise<void>>()
			.mockRejectedValueOnce(new Error("temporary acknowledgement failure"))
			.mockResolvedValueOnce(undefined);

		await expect(
			commitProjectionSpeechTarget({
				state,
				inspection,
				projection,
				commitSpeech,
				acknowledge,
			}),
		).resolves.toMatchObject({
			status: "error",
			speechId: "speech-1",
		});
		expect(state.deliveredSpeechId).toBe("delivery:speech-1");

		await expect(
			commitProjectionSpeechTarget({
				state,
				inspection,
				projection,
				commitSpeech,
				acknowledge,
			}),
		).resolves.toEqual({
			channel: "speech",
			status: "committed",
			speechId: "speech-1",
		});
		await expect(
			commitProjectionSpeechTarget({
				state,
				inspection,
				projection,
				commitSpeech,
				acknowledge,
			}),
		).resolves.toEqual({
			channel: "speech",
			status: "skipped",
			reason: "duplicate-speech",
		});

		expect(commitSpeech).toHaveBeenCalledTimes(1);
		expect(acknowledge).toHaveBeenCalledTimes(2);
		expect(identity).toHaveBeenCalledTimes(3);
		expect(state.deliveredSpeechId).toBe(null);
		expect(state.lastAcknowledgedSpeechId).toBe("delivery:speech-1");
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
		expect(state.activeSpeechId).toBe(null);
		expect(state.deliveredSpeechId).toBe(null);
		expect(state.lastAcknowledgedSpeechId).toBe("speech-2");
	});
});
