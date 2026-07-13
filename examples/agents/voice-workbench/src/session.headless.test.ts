import { test as igniteTest } from "ignite-element/testing";
import { describe, expect, it, vi } from "vitest";
import { component, source } from "./session";

const nodes = [
	{
		kind: "decision-log",
		id: "decision-entries",
		entries: [
			{
				id: "ignite",
				title: "Runtime",
				decision: "Use Ignite",
				rationale: "One behavior model",
			},
		],
	},
	{
		kind: "action",
		id: "complete-response",
		label: "Complete response",
		commandName: "completeResponse",
		payload: { text: "Decision captured." },
	},
] as const;

describe("voice workbench headless component", () => {
	it("drives one continuing projection-ready session directly", async () => {
		const schema = component.getSchema();
		expect(Object.keys(schema.commands)).toEqual([
			"acknowledgeSpeech",
			"completeResponse",
			"createArtifact",
			"reviseArtifact",
			"submitPrompt",
		]);
		expect(() => JSON.stringify(schema)).not.toThrow();
		expect(schema.commands.createArtifact).toMatchObject({
			input: {
				properties: {
					nodes: {
						items: {
							properties: {
								kind: {
									enum: [
										"text",
										"checklist",
										"action",
										"form",
										"table",
										"timeline",
										"chart",
										"code-diff",
										"decision-log",
									],
								},
								text: { type: "string" },
								items: { type: "array" },
								commandName: {
									enum: ["completeResponse"],
								},
								fields: { type: "array" },
								columns: { type: "array" },
								rows: { type: "array" },
								events: { type: "array" },
								chartType: { enum: ["bar", "line", "pie"] },
								series: { type: "array" },
								before: { type: "string" },
								after: { type: "string" },
								entries: { type: "array" },
							},
						},
					},
				},
			},
		});
		const initialSnapshot = component.getSnapshot();
		expect(initialSnapshot.matches("ready")).toBe(true);
		expect(initialSnapshot.context).not.toHaveProperty("phase");
		expect(component.getView()).toMatchObject({
			status: "ready",
			statusLabel: "Ready",
			canSubmitPrompt: true,
			artifacts: [],
			speech: null,
		});
		expect(component.getView()).not.toHaveProperty("documents");
		expect(component.canExecute("submitPrompt")).toBe(true);
		expect(component.canExecute("acknowledgeSpeech")).toBe(false);
		source.send({
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: " " },
		});
		expect(component.getSnapshot().matches("ready")).toBe(true);
		expect(component.getSnapshot().context.lastFact).toEqual({
			type: "artifact-rejected",
			reason: "validation",
		});

		const snapshots = vi.fn();
		const views = vi.fn();
		const snapshotSubscription = component.watchSnapshot(snapshots);
		const viewSubscription = component.watchView(views);

		(
			await igniteTest(component).when({
				command: "submitPrompt",
				input: { modality: "text", text: "Capture a decision" },
			})
		)
			.expectEvent({
				type: "prompt-submitted",
				turnId: "voice-workbench:1",
				modality: "text",
				text: "Capture a decision",
			})
			.expectView({
				messageCount: 1,
				messages: [
					{
						role: "user",
						channel: "text",
						text: "Capture a decision",
					},
				],
				lastFact: {
					type: "prompt-submitted",
					modality: "text",
					text: "Capture a decision",
				},
				status: "responding",
				statusLabel: "Responding",
				canSubmitPrompt: false,
			});
		expect(component.getSnapshot().matches("responding")).toBe(true);

		(
			await igniteTest(component).when({
				command: "createArtifact",
				input: { id: "decision", title: "Decision", nodes },
			})
		)
			.expectEvent({
				type: "artifact-created",
				artifactId: "decision",
				revision: "1",
			})
			.expectView({
				artifacts: [
					{
						id: "decision",
						revision: "1",
						nodes: [
							{ id: "decision-entries", action: null },
							{
								id: "complete-response",
								action: {
									enabled: true,
									input: { text: "Decision captured." },
								},
							},
						],
					},
				],
			});
		expect(component.getSnapshot().context.documents).toEqual([
			expect.objectContaining({
				id: "decision",
				nodes: expect.arrayContaining([
					expect.objectContaining({
						commandName: "completeResponse",
						payload: { text: "Decision captured." },
					}),
				]),
			}),
		]);
		expect(component.canExecute("reviseArtifact")).toBe(true);
		source.send({
			type: "COMPLETE_RESPONSE",
			input: { text: " " },
		});
		expect(component.getSnapshot().matches("responding")).toBe(true);
		expect(component.getSnapshot().context.lastFact).toEqual({
			type: "artifact-rejected",
			reason: "validation",
		});

		(
			await igniteTest(component).when({
				command: "reviseArtifact",
				input: {
					artifactId: "decision",
					expectedRevision: "9",
					nodes,
				},
			})
		).expectEvent({ type: "artifact-rejected", reason: "conflict" });

		(
			await igniteTest(component).when({
				command: "completeResponse",
				input: { text: "Decision captured.", speech: "Decision captured." },
			})
		)
			.expectEvent({ type: "response-completed" })
			.expectView({
				status: "ready",
				speech: { text: "Decision captured.", status: "pending" },
			});
		expect(component.canExecute("acknowledgeSpeech")).toBe(true);

		const speech = component.getView().speech;
		expect(speech).not.toBeNull();
		if (!speech) return;
		(
			await igniteTest(component).when({
				command: "acknowledgeSpeech",
				input: { id: speech.id },
			})
		).expectView({ speech: { id: speech.id, status: "acknowledged" } });
		expect(component.canExecute("acknowledgeSpeech")).toBe(false);

		expect(snapshots).toHaveBeenCalled();
		expect(views).toHaveBeenCalled();
		expect(component.getSnapshot().context.revision).toBe(
			component.getView().revision,
		);
		snapshotSubscription.unsubscribe();
		viewSubscription.unsubscribe();
		source.stop();
	});
});
