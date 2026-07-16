import {
	createProjectionDocumentTarget,
	createProjectionSpeechTarget,
} from "ignite-element/xstate";
import { describe, expect, it, vi } from "vitest";
import {
	component,
	recordTurnTerminal,
	reportModelAvailable,
	source,
} from "./session";

describe("voice workbench projection targets", () => {
	it("commits documents and acknowledged speech through direct component targets", async () => {
		reportModelAvailable();
		const commitDocument = vi.fn();
		const commitSpeech = vi.fn();
		const documentSession = component(
			createProjectionDocumentTarget({ commitDocument }),
		);
		const speechSession = component(
			createProjectionSpeechTarget({
				commitSpeech,
				acknowledgeCommandName: "acknowledgeSpeech",
				resolveAcknowledgePayload: ({ id }) => ({ id }),
			}),
		);

		await component.execute({
			command: "submitPrompt",
			input: { modality: "text", text: "Capture a decision" },
		});
		await component.execute({
			command: "createArtifact",
			input: {
				id: "decision",
				title: "Decision",
				nodes: [
					{
						kind: "decision-log",
						id: "decision-entries",
						entries: [
							{
								id: "runtime",
								title: "Runtime",
								decision: "Use Ignite",
								rationale: "One behavior model",
							},
						],
					},
				],
			},
		});
		await vi.waitFor(() =>
			expect(commitDocument).toHaveBeenLastCalledWith(
				expect.objectContaining({ id: "decision", revision: "1" }),
			),
		);

		await component.execute({
			command: "completeResponse",
			input: { text: "Decision captured.", speech: "Decision captured." },
		});
		const turnId = source.getSnapshot().context.activeTurnId;
		if (!turnId) throw new Error("Expected an active projection turn.");
		recordTurnTerminal({ type: "TURN_COMPLETED", turnId });
		await vi.waitFor(() => {
			expect(commitSpeech).toHaveBeenCalledWith(
				expect.objectContaining({
					text: "Decision captured.",
					status: "pending",
				}),
			);
			expect(component.getView().speech).toMatchObject({
				text: "Decision captured.",
				status: "acknowledged",
			});
		});

		documentSession.dispose();
		speechSession.dispose();
		source.stop();
	});
});
