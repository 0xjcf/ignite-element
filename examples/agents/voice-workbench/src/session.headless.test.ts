import { test as igniteTest } from "ignite-element/testing";
import { describe, expect, it, vi } from "vitest";
import { component, source } from "./session";

const nodes = [
	{
		kind: "checklist",
		id: "decision-checklist",
		items: [{ id: "verify", label: "Verify decision", checked: false }],
	},
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
			"beginModelPreparation",
			"cancelVoiceCapture",
			"changeArtifactView",
			"changeDraft",
			"changeMobilePanel",
			"changeSpeechPreference",
			"commitDocument",
			"commitSpeech",
			"completeResponse",
			"createArtifact",
			"playSpeech",
			"presentVoice",
			"recordCapabilityOutcome",
			"recordRuntimeManifest",
			"recordTurn",
			"replay",
			"reportModelAvailable",
			"reportModelFailure",
			"restoreArtifactRevision",
			"reviseArtifact",
			"selectArtifact",
			"selectRuntimePreview",
			"setChecklistItem",
			"startVoiceCapture",
			"submitPrompt",
			"submitVoiceTranscript",
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
								items: { type: "array", minItems: 1 },
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
		expect(schema.commands.setChecklistItem).toMatchObject({
			input: {
				type: "object",
				required: [
					"artifactId",
					"expectedRevision",
					"nodeId",
					"itemId",
					"checked",
				],
				properties: {
					artifactId: { type: "string", minLength: 1 },
					expectedRevision: { type: "string", minLength: 1 },
					nodeId: { type: "string", minLength: 1 },
					itemId: { type: "string", minLength: 1 },
					checked: { type: "boolean" },
				},
			},
		});
		expect(schema.commands.restoreArtifactRevision).toMatchObject({
			input: {
				type: "object",
				required: ["artifactId", "expectedRevision", "revision"],
			},
		});
		expect(schema.commands.selectArtifact).toMatchObject({
			input: {
				type: "object",
				required: ["artifactId"],
			},
		});
		const initialSnapshot = component.getSnapshot();
		expect(initialSnapshot.matches({ provider: "preparing" })).toBe(true);
		expect(initialSnapshot.matches({ turn: "ready" })).toBe(true);
		expect(initialSnapshot.context).not.toHaveProperty("phase");
		expect(component.getView()).toMatchObject({
			status: "preparing",
			statusLabel: "Preparing local model",
			canSubmitPrompt: false,
			canRetryModel: false,
			activeArtifact: null,
			turnCount: 0,
			turnLabel: "0 turns",
			speechStatus: "idle",
			documentSchema: JSON.stringify({ artifacts: [] }, null, 2),
			voiceState: "idle",
			transcript: null,
			transcriptReady: false,
			microphoneUnavailable: false,
			voiceFailure: null,
			turnMessage: "",
			lastFactLabel: "no actor facts yet",
			modelPreparing: true,
			modelFailed: false,
			promptPlaceholder: "Waiting for the local model to finish preparing…",
			turnState: "ready",
			model: { status: "preparing", failure: null },
			artifacts: [],
			speech: null,
			presentation: {
				artifactView: "document",
				runtimePreview: "browser",
				runtimeManifest: [],
				capabilityOutcomes: [],
				draft: "",
				mobilePanel: "conversation",
				speakResponses: true,
				turn: null,
				voice: { type: "voice-idle" },
			},
			runtimeInspector: {
				activeStates: { provider: "preparing", turn: "ready" },
				mlx: {
					status: "preparing",
					ready: false,
					heading: "MLX model readiness",
					statusLabel: "preparing",
					detail: "Prompts remain gated",
				},
				actor: {
					lastFact: null,
					revision: 0,
					heading: "Parallel actor state",
					matchText:
						'matches({\n  provider: "preparing",\n  turn: "ready",\n})',
					factLabel: "Current actor fact · no actor facts yet",
				},
				selectedPreview: "browser",
				preview: {
					text: "Browser JSX preview\nNo accepted artifact yet\nno actor facts yet",
					selectors: [
						{ id: "browser", label: "Browser preview", selected: true },
						{ id: "terminal", label: "Terminal preview", selected: false },
						{ id: "speech", label: "Speech preview", selected: false },
						{ id: "headless", label: "Headless preview", selected: false },
					],
				},
				capabilityRows: [
					{
						heading: "No external capability facts yet",
						statusLabel: "waiting",
					},
				],
				trace: {
					acceptedArtifactLabel: "Awaiting accepted artifact",
					rows: [
						{
							key: "transcript",
							heading: "Text or speech transcript",
						},
						{
							key: "actor-fact",
							heading: "no actor facts yet",
						},
						{
							key: "artifact",
							heading: "Awaiting accepted artifact",
						},
					],
				},
				receipts: expect.arrayContaining([
					expect.objectContaining({
						id: "terminal",
						detail: "preview only · no remote terminal sync",
					}),
				]),
				schemaExplorer: {
					manifest: {
						heading: "Availability-scoped model manifest",
						countLabel: "0 live commands",
						rows: [
							{
								name: "Awaiting the next model request",
								summaryLabel: "no live commands captured",
							},
						],
					},
					blueprint: {
						heading: "All-component blueprint",
						countLabel: "27 commands from getSchema()",
					},
				},
			},
		});
		expect(component.getView()).not.toHaveProperty("documents");
		expect(component.canExecute("submitPrompt")).toBe(false);
		expect(component.canExecute("acknowledgeSpeech")).toBe(false);
		await expect(
			component.execute({
				command: "submitPrompt",
				input: { modality: "text", text: "Too early" },
			}),
		).resolves.toMatchObject({ events: [] });
		expect(component.getSnapshot().context.messages).toEqual([]);
		await component.execute({
			command: "recordRuntimeManifest",
			input: [
				{
					name: "createArtifact",
					description: "Create an artifact",
					inputSchema: { type: "object", properties: {} },
					gated: true,
					ownerId: "workbench-component",
				},
			],
		});
		await component.execute({
			command: "selectRuntimePreview",
			input: "terminal",
		});
		for (let index = 0; index < 14; index += 1) {
			await component.execute({
				command: "recordCapabilityOutcome",
				input: {
					type: "success",
					ownerId: "web-search",
					toolName: `search-${index}`,
					message: `Search ${index} completed`,
				},
			});
		}
		expect(component.getView().runtimeInspector).toMatchObject({
			activeStates: { provider: "preparing", turn: "ready" },
			mlx: { status: "preparing", ready: false },
			selectedPreview: "terminal",
			preview: {
				text: expect.stringContaining("Preview only · no remote terminal sync"),
			},
			schemaExplorer: {
				manifest: {
					countLabel: "1 live command",
					rows: [
						{
							name: "createArtifact",
							summaryLabel: "workbench-component · live · gated",
						},
					],
				},
			},
		});
		expect(component.getView().runtimeInspector.capabilityRows).toHaveLength(
			12,
		);
		const firstCapabilityRow =
			component.getView().runtimeInspector.capabilityRows[0];
		expect(firstCapabilityRow?.heading).toBe("web-search · search-2");
		await component.execute({
			command: "recordCapabilityOutcome",
			input: {
				type: "timeout",
				ownerId: "web-search",
				toolName: "searchWeb",
				message: "Configured fallback timed out.",
				fallback: {
					from: "brave-web-search",
					provider: "fixture-search",
					status: 503,
					outcome: "timeout",
				},
			},
		});
		expect(
			component.getView().runtimeInspector.capabilityRows.slice(-1)[0],
		).toMatchObject({
			statusLabel: "timeout",
			message:
				"Configured fallback timed out. · fallback brave-web-search → fixture-search · trigger HTTP 503 · timeout",
		});
		await component.execute({
			command: "reportModelFailure",
			input: {
				kind: "network",
				message: "The local model could not be reached.",
			},
		});
		expect(component.getView()).toMatchObject({
			status: "failed",
			statusLabel: "Model unavailable",
			canRetryModel: true,
			canSubmitPrompt: false,
			model: {
				status: "failed",
				failure: { kind: "network" },
			},
			modelPreparing: false,
			modelFailed: true,
			promptPlaceholder: "Retry the local model before sending a prompt…",
		});
		await component.execute({ command: "beginModelPreparation" });
		expect(component.getView()).toMatchObject({
			status: "preparing",
			canRetryModel: false,
			model: { status: "preparing", failure: null },
		});
		await component.execute({ command: "reportModelAvailable" });
		expect(component.getView()).toMatchObject({
			status: "ready",
			statusLabel: "Ready",
			canSubmitPrompt: true,
			model: { status: "available", failure: null },
			runtimeInspector: {
				activeStates: { provider: "available", turn: "ready" },
				mlx: { status: "available", ready: true },
			},
		});
		expect(component.canExecute("submitPrompt")).toBe(true);
		source.send({
			type: "SUBMIT_PROMPT",
			input: { modality: "text", text: " " },
		});
		expect(component.getSnapshot().matches({ turn: "ready" })).toBe(true);
		expect(component.getSnapshot().context.lastFact).toEqual({
			type: "artifact-rejected",
			reason: "validation",
		});

		const snapshots = vi.fn();
		const views = vi.fn();
		const snapshotSubscription = component.watchSnapshot(snapshots);
		const viewSubscription = component.watchView(views);
		await component.execute({
			command: "changeDraft",
			input: "Preserve this draft",
		});
		await component.execute({
			command: "presentVoice",
			input: { type: "voice-listening" },
		});
		expect(component.getView()).toMatchObject({
			presentation: {
				draft: "Preserve this draft",
				voice: { type: "voice-listening" },
			},
			voiceState: "listening",
		});

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
				turnCount: 1,
				turnLabel: "1 turn",
				turnState: "responding",
				respondingProgress: {
					actorOutcome: "No actor command accepted yet",
					actorOutcomeRecorded: false,
					pendingResult: "Awaiting the first model or capability result",
				},
			});
		expect(component.getSnapshot().matches({ turn: "responding" })).toBe(true);
		expect(component.canExecute("completeResponse")).toBe(false);
		expect(component.getView()).toMatchObject({
			presentation: {
				draft: "Preserve this draft",
				voice: { type: "voice-listening" },
			},
		});

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
				respondingProgress: {
					actorOutcome: "Actor accepted artifact revision 1",
					actorOutcomeRecorded: true,
					pendingResult: "Awaiting the next model or capability result",
				},
				artifacts: [
					{
						id: "decision",
						revision: "1",
						nodes: [
							{ id: "decision-checklist", action: null },
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
		expect(component.canExecute("completeResponse")).toBe(true);
		expect(component.canExecute("setChecklistItem")).toBe(true);
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
		expect(component.getSnapshot().context.artifactRevisions).toEqual([
			expect.objectContaining({ id: "decision", revision: "1" }),
		]);
		expect(component.getView().modelContext).not.toHaveProperty(
			"artifactRevisions",
		);
		expect(component.getView()).toMatchObject({
			activeArtifact: { id: "decision", revision: "1" },
		});
		expect(component.getView().documentSchema).toContain('"id": "decision"');
		expect(component.canExecute("reviseArtifact")).toBe(true);
		(
			await igniteTest(component).when({
				command: "setChecklistItem",
				input: {
					artifactId: "decision",
					expectedRevision: "1",
					nodeId: "decision-checklist",
					itemId: "verify",
					checked: true,
				},
			})
		).expectEvent({
			type: "artifact-revised",
			artifactId: "decision",
			revision: "2",
		});
		expect(component.getSnapshot().matches({ turn: "responding" })).toBe(true);
		source.send({
			type: "COMPLETE_RESPONSE",
			input: { text: " " },
		});
		expect(component.getSnapshot().matches({ turn: "responding" })).toBe(true);
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
		expect(component.getSnapshot().context.artifactRevisions).toHaveLength(2);

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
		expect(component.canExecute("setChecklistItem")).toBe(true);
		(
			await igniteTest(component).when({
				command: "setChecklistItem",
				input: {
					artifactId: "decision",
					expectedRevision: "2",
					nodeId: "decision-checklist",
					itemId: "verify",
					checked: false,
				},
			})
		).expectEvent({
			type: "artifact-revised",
			artifactId: "decision",
			revision: "3",
		});
		expect(component.getView().activeArtifact).toMatchObject({
			id: "decision",
			revision: "3",
		});
		expect(component.getView().activeArtifact?.nodes[0]).toMatchObject({
			id: "decision-checklist",
			items: [{ id: "verify", checked: false }],
		});
		expect(component.getSnapshot().context.artifactRevisions).toHaveLength(3);
		expect(component.getView()).toMatchObject({
			artifactSummaries: [
				{
					id: "decision",
					revision: "3",
					nodeCount: 3,
					active: true,
				},
			],
			activeArtifactRevisions: [
				{ revision: "1", current: false },
				{ revision: "2", current: false },
				{ revision: "3", current: true },
			],
			canRestoreArtifactRevision: true,
		});
		(
			await igniteTest(component).when({
				command: "restoreArtifactRevision",
				input: {
					artifactId: "decision",
					expectedRevision: "3",
					revision: "1",
				},
			})
		).expectEvent({
			type: "artifact-restored",
			artifactId: "decision",
			fromRevision: "1",
			revision: "4",
		});
		(
			await igniteTest(component).when({
				command: "selectArtifact",
				input: { artifactId: "decision" },
			})
		).expectEvent({ type: "artifact-selected", artifactId: "decision" });
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
