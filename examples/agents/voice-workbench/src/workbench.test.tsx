// @vitest-environment jsdom
import { test as igniteTest } from "ignite-element/testing";
import { describe, expect, it } from "vitest";
import { component, source } from "./session";
import { renderWorkbench } from "./workbench";
import workbenchSource from "./workbench.tsx?raw";

describe("voice workbench accessible JSX", () => {
	it("maps view-ready inspector rows without presentation derivation in JSX", () => {
		const runtimeRail = workbenchSource.slice(
			workbenchSource.indexOf("<aside\n\t\t\t\t\t\tclass={`panel runtime"),
		);

		expect(runtimeRail).not.toContain('row.kind === "empty"');
		expect(runtimeRail).not.toMatch(/row\.ownerLabel/);
		expect(runtimeRail).not.toMatch(/commit-\$\{receipt\.id\}/);
		expect(runtimeRail).not.toContain('domainId === "product-pricing"');
		expect(runtimeRail).not.toContain('outcome === "needs-input"');
		expect(runtimeRail).not.toContain("standard sandwich bread");
		expect(runtimeRail).toContain("domainPolicyCards.map");
	});

	it("renders the approved empty-to-artifact workflow from the component view", async () => {
		const bridge = igniteTest.accessibilityBridge(component, renderWorkbench, {
			elementName: "voice-workbench-accessibility",
		});

		expect(
			igniteTest.expectControls(bridge, [
				{ role: "textbox", name: "Prompt" },
				{ role: "button", name: "Start speech input" },
				{ role: "button", name: "Send" },
				{ role: "tab", name: "Document" },
				{ role: "tab", name: "Schema" },
			]),
		).toHaveLength(5);
		expect(
			bridge.host.shadowRoot?.querySelector(
				'output[aria-label="Conversation status"]',
			)?.textContent,
		).toContain("Preparing local model");
		expect(bridge.host.shadowRoot?.textContent).toContain(
			"Preparing the local MLX model",
		);
		expect(
			(
				bridge.getByRole("textbox", {
					name: "Prompt",
				}) as HTMLTextAreaElement
			).disabled,
		).toBe(true);
		await component.execute({
			command: "reportModelFailure",
			input: {
				kind: "network",
				message: "The local model could not be reached.",
			},
		});
		expect(bridge.host.shadowRoot?.textContent).toContain(
			"The local model could not be reached.",
		);
		bridge.getByRole("button", { name: "Retry model" }).click();
		expect(component.getView().status).toBe("preparing");
		await component.execute({ command: "reportModelAvailable" });
		await component.execute({
			command: "recordRuntimeManifest",
			input: [
				{
					name: "searchWeb",
					description: "Search the web with a bounded query batch.",
					ownerId: "web-search",
					gated: false,
					inputSchema: {
						type: "object",
						required: ["queries"],
						properties: {
							queries: {
								type: "array",
								minItems: 1,
								maxItems: 8,
								items: {
									type: "object",
									required: ["query"],
									properties: {
										query: { type: "string", minLength: 1 },
									},
								},
							},
						},
					},
				},
			],
		});
		await component.execute({
			command: "recordCapabilityOutcome",
			input: {
				type: "timeout",
				ownerId: "web-search",
				toolName: "searchWeb",
				message: "Retry budget exhausted.",
				status: 429,
			},
		});
		await component.execute({
			command: "recordDomainPolicyDecision",
			input: {
				type: "domain-policy-decision",
				domainId: "product-pricing",
				domainLabel: "Product pricing",
				policyId: "representative-product-selection",
				policyLabel: "Representative product selection",
				outcome: "needs-input",
				summary: "Pricing research is paused for clarification.",
				assumptions: [
					{
						id: "bread-default",
						label: "Bread uses a representative 20 oz loaf.",
					},
				],
				questions: [
					{
						id: "location",
						prompt: "Which retailer location should be used for pricing?",
					},
				],
				evidenceRequirements: [
					{
						id: "source",
						label: "Materialize exact Price, Status, and Source facts.",
					},
				],
			},
		});
		expect(component.getView().runtimeInspector).toMatchObject({
			mlx: {
				heading: "MLX model readiness",
				statusLabel: "available",
				detail: "Inference admitted for prompts",
			},
			capabilityRows: [
				{
					className: "capability-outcome",
					heading: "web-search · searchWeb",
					statusLabel: "timeout · HTTP 429",
					message: "Retry budget exhausted.",
				},
			],
			schemaExplorer: {
				manifest: {
					countLabel: "1 live command",
					rows: [
						{
							name: "searchWeb",
							summaryLabel: "web-search · live · available",
							schemaText: expect.stringContaining("queries · array · required"),
						},
					],
				},
			},
		});
		expect(
			bridge.host.shadowRoot?.querySelector(
				'output[aria-label="Conversation status"]',
			)?.textContent,
		).toContain("Ready");
		expect(bridge.host.shadowRoot?.textContent).toContain(
			"Your first accepted artifact will appear here",
		);
		expect(bridge.host.shadowRoot?.textContent).toContain("0 turns");
		expect(bridge.host.shadowRoot?.textContent).toContain("0 artifacts");
		expect(bridge.host.shadowRoot?.textContent).not.toContain("browser-demo");
		expect(bridge.host.shadowRoot?.textContent).toContain(
			"MLX model readiness",
		);
		expect(bridge.host.shadowRoot?.textContent).toContain(
			"Parallel actor state",
		);
		expect(bridge.host.shadowRoot?.textContent).toContain(
			"Capability outcomes",
		);
		expect(bridge.host.shadowRoot?.textContent).toContain(
			"Retry budget exhausted.",
		);
		const policyProof = bridge.host.shadowRoot?.querySelector(
			'[aria-label="Domain policy proof"]',
		);
		expect(policyProof?.textContent).toContain("Product pricing");
		expect(policyProof?.textContent).toContain(
			"Representative product selection",
		);
		expect(policyProof?.textContent).toContain("needs input");
		expect(policyProof?.textContent).toContain(
			"Bread uses a representative 20 oz loaf.",
		);
		expect(policyProof?.textContent).toContain(
			"Which retailer location should be used for pricing?",
		);
		expect(policyProof?.textContent).toContain(
			"Materialize exact Price, Status, and Source facts.",
		);
		expect(
			bridge.getByRole("button", { name: "Browser preview" }),
		).toBeTruthy();
		expect(
			bridge.getByRole("button", { name: "Terminal preview" }),
		).toBeTruthy();
		expect(bridge.getByRole("button", { name: "Speech preview" })).toBeTruthy();
		expect(
			bridge.getByRole("button", { name: "Headless preview" }),
		).toBeTruthy();
		bridge.getByRole("button", { name: "Terminal preview" }).click();
		expect(component.getView().runtimeInspector.selectedPreview).toBe(
			"terminal",
		);
		expect(
			bridge.host.shadowRoot?.querySelector(".projection-preview")?.textContent,
		).toContain("Preview only · no remote terminal sync");
		expect(bridge.host.shadowRoot?.textContent).toContain(
			"Availability-scoped model manifest",
		);
		expect(bridge.host.shadowRoot?.textContent).toContain(
			"All-component blueprint",
		);
		const searchSchema = bridge.host.shadowRoot?.querySelector(
			'[data-command-name="searchWeb"]',
		)?.textContent;
		expect(searchSchema).toContain("web-search");
		expect(searchSchema).toContain("live");
		expect(searchSchema).toContain("queries · array · required");
		expect(searchSchema).toContain("minItems: 1");
		expect(searchSchema).toContain("maxItems: 8");
		expect(searchSchema).toContain("query · string · required");
		expect(
			bridge.host.shadowRoot?.querySelector(".actor-match")?.textContent,
		).toBe(`matches({
  provider: "available",
  turn: "ready",
})`);

		const prompt = bridge.getByRole("textbox", { name: "Prompt" });
		if (!(prompt instanceof HTMLTextAreaElement)) {
			throw new Error("workbench prompt form is unavailable");
		}
		prompt.value = "Show the decision";
		prompt.dispatchEvent(new Event("input", { bubbles: true }));
		const form = bridge
			.getByRole("textbox", { name: "Prompt" })
			.closest("form");
		if (!(form instanceof HTMLFormElement)) {
			throw new Error("workbench prompt form is unavailable");
		}
		form.dispatchEvent(
			new Event("submit", { bubbles: true, cancelable: true }),
		);
		expect(component.getView().status).toBe("responding");
		expect(
			bridge.host.shadowRoot?.querySelector(".progress-card")?.textContent,
		).toContain("Awaiting the first model or capability result");
		expect(
			bridge.host.shadowRoot?.querySelector(".progress-card")?.textContent,
		).toContain("No actor command accepted yet");
		expect(bridge.host.shadowRoot?.textContent).toContain("1 turn");
		expect(bridge.host.shadowRoot?.textContent).not.toContain("1 turns");
		await component.execute({
			command: "createArtifact",
			input: {
				id: "decision",
				title: "Decision",
				nodes: [
					{
						kind: "checklist",
						id: "decision-checklist",
						items: [
							{
								id: "ship",
								label: "Ship Ignite",
								checked: false,
							},
						],
					},
					{
						kind: "text",
						id: "summary",
						text: "Ignite owns the projection.",
					},
					{
						kind: "form",
						id: "owner-form",
						title: "Owner",
						fields: [
							{
								id: "owner",
								label: "Owner team",
								input: { type: "string", minLength: 1 },
								value: "Runtime",
								description: "Accountable team",
							},
						],
					},
					{
						kind: "table",
						id: "budget",
						columns: [
							{ id: "item", label: "Item" },
							{ id: "cost", label: "Cost" },
							{ id: "source", label: "Source" },
						],
						rows: [
							{
								id: "hosting",
								cells: ["Hosting", "$40", "https://example.com/hosting"],
							},
						],
					},
					{
						kind: "timeline",
						id: "milestones",
						events: [
							{
								id: "launch",
								label: "Launch",
								timestamp: "2026-07-20",
								detail: "Ship the example",
							},
						],
					},
					{
						kind: "chart",
						id: "spend",
						chartType: "bar",
						series: [{ id: "used", label: "Budget used", value: 40 }],
					},
					{
						kind: "code-diff",
						id: "contract-diff",
						language: "ts",
						before: "render(document)",
						after: 'component("voice-workbench", view)',
					},
					{
						kind: "decision-log",
						id: "decisions",
						entries: [
							{
								id: "runtime",
								title: "Runtime",
								decision: "Keep the actor authoritative",
								rationale: "Every projection consumes accepted state",
							},
						],
					},
					{
						kind: "action",
						id: "complete",
						label: "Complete response",
						commandName: "completeResponse",
						payload: { text: "Decision complete." },
					},
				],
			},
		});
		expect(
			bridge.host.shadowRoot?.querySelector(".progress-card")?.textContent,
		).toContain("Actor accepted artifact revision 1");
		expect(
			bridge.host.shadowRoot?.querySelector(".progress-card")?.textContent,
		).toContain("Awaiting the next model or capability result");
		expect(
			bridge.host.shadowRoot?.querySelector(".progress-card")?.textContent,
		).not.toContain("Model proposing commands");
		expect(
			bridge.host.shadowRoot?.querySelector(".progress-card")?.textContent,
		).not.toContain("Actor validating semantic nodes");

		expect(bridge.host.shadowRoot?.textContent).toContain("Text prompt");
		expect(bridge.host.shadowRoot?.textContent).toContain("Show the decision");
		expect(bridge.host.shadowRoot?.textContent).toContain(
			"Ignite owns the projection.",
		);
		expect(bridge.host.shadowRoot?.textContent).toContain(
			"decision · revision 1",
		);
		expect(
			bridge.host.shadowRoot?.querySelectorAll("[data-node-kind]").length,
		).toBe(9);
		expect(
			Array.from(
				bridge.host.shadowRoot?.querySelectorAll("[data-node-kind]") ?? [],
			).map((node) => node.getAttribute("data-node-kind")),
		).toEqual([
			"checklist",
			"text",
			"form",
			"table",
			"timeline",
			"chart",
			"code-diff",
			"decision-log",
			"action",
		]);
		expect(bridge.getByRole("textbox", { name: "Owner team" })).toHaveProperty(
			"readOnly",
			true,
		);
		expect(
			bridge.host.shadowRoot?.querySelector("table")?.textContent,
		).toContain("Hosting");
		const sourceLink = bridge.getByRole("link", {
			name: "Source: example.com",
		});
		expect(sourceLink).toHaveProperty("href", "https://example.com/hosting");
		expect(sourceLink.getAttribute("target")).toBe("_blank");
		expect(sourceLink.getAttribute("rel")).toBe("noopener noreferrer");
		expect(
			bridge.host.shadowRoot?.querySelector('[aria-label="Timeline"]')
				?.textContent,
		).toContain("Launch");
		expect(
			bridge.host.shadowRoot
				?.querySelector("progress")
				?.getAttribute("aria-label"),
		).toBe("Budget used: 40");
		expect(
			bridge.host.shadowRoot
				?.querySelector('[data-node-kind="chart"]')
				?.getAttribute("aria-label"),
		).toBe("bar chart: Budget used 40");
		expect(
			bridge.host.shadowRoot?.querySelector('[aria-label="Decision log"]')
				?.textContent,
		).toContain("Keep the actor authoritative");
		expect(
			bridge.host.shadowRoot?.querySelector('[aria-label="Artifacts"]')
				?.textContent,
		).toContain("Decision");

		const schemaTab = bridge.getByRole("tab", { name: "Schema" });
		schemaTab.click();
		expect(component.getView()).toMatchObject({
			presentation: { artifactView: "schema" },
		});
		expect(
			bridge.getByRole("tab", { name: "Schema" }).getAttribute("aria-selected"),
		).toBe("true");
		expect(
			bridge.host.shadowRoot?.querySelector(".schema-view")?.textContent,
		).toContain('"revision": "1"');

		const action = bridge.getByRole("button", { name: "Complete response" });
		const pendingChecklistItem = bridge.getByRole("checkbox", {
			name: "Ship Ignite",
		}) as HTMLInputElement;
		expect(pendingChecklistItem.disabled).toBe(true);
		action.focus();
		expect(bridge.root.activeElement).toBe(action);
		action.click();
		expect(component.getView().status).toBe("ready");
		bridge.getByRole("tab", { name: "Document" }).click();
		const checklistItem = bridge.getByRole("checkbox", {
			name: "Ship Ignite",
		}) as HTMLInputElement;
		expect(checklistItem.disabled).toBe(false);
		expect(checklistItem.checked).toBe(false);
		checklistItem.click();
		expect(component.getView().activeArtifact).toMatchObject({
			id: "decision",
			revision: "2",
		});
		expect(component.getView().activeArtifact?.nodes[0]).toMatchObject({
			id: "decision-checklist",
			items: [{ id: "ship", checked: true }],
		});
		expect(
			(
				bridge.getByRole("checkbox", {
					name: "Ship Ignite",
				}) as HTMLInputElement
			).checked,
		).toBe(true);
		expect(
			bridge.host.shadowRoot?.querySelector('[aria-label="Revision history"]')
				?.textContent,
		).toContain("Revision 2");
		bridge.getByRole("button", { name: "Restore revision 1" }).click();
		expect(component.getView().activeArtifact).toMatchObject({
			id: "decision",
			revision: "3",
		});
		expect(
			(
				bridge.getByRole("checkbox", {
					name: "Ship Ignite",
				}) as HTMLInputElement
			).checked,
		).toBe(false);

		const secondPrompt = bridge.getByRole("textbox", { name: "Prompt" });
		if (!(secondPrompt instanceof HTMLTextAreaElement)) {
			throw new Error("workbench prompt form is unavailable");
		}
		secondPrompt.value = "Add a separate receipt";
		secondPrompt.dispatchEvent(new Event("input", { bubbles: true }));
		secondPrompt
			.closest("form")
			?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
		await component.execute({
			command: "createArtifact",
			input: {
				id: "receipt",
				title: "Receipt",
				nodes: [
					{
						kind: "table",
						id: "receipt-lines",
						columns: [{ id: "item", label: "Item" }],
						rows: [{ id: "coffee", cells: ["Coffee"] }],
					},
				],
			},
		});
		await component.execute({
			command: "completeResponse",
			input: { text: "Receipt added." },
		});
		expect(component.getView()).toMatchObject({
			activeArtifact: { id: "receipt", revision: "1" },
			artifactSummaries: [
				{ id: "decision", active: false },
				{ id: "receipt", active: true },
			],
		});
		bridge.getByRole("button", { name: "Decision, revision 3" }).click();
		expect(component.getView().activeArtifact).toMatchObject({
			id: "decision",
			revision: "3",
		});

		await component.execute({
			command: "recordTurn",
			input: {
				type: "accepted",
				trace: [{ command: "searchWeb", accepted: true }],
				capability: {
					provider: "brave-web-search",
					tool: "searchWeb",
					outcome: "success",
					queryCount: 4,
					sourceCount: 4,
				},
			},
		});
		expect(
			bridge.host.shadowRoot?.querySelector(".capability-proof")?.textContent,
		).toContain("brave-web-search · searchWeb");
		expect(
			bridge.host.shadowRoot?.querySelector(".capability-proof")?.textContent,
		).toContain("success · 4 queries · 4 sources");

		await component.execute({
			command: "recordTurn",
			input: {
				type: "model-failed",
				failureKind: "configuration",
				message:
					"Capability configuration rejected duplicate tool names: searchWeb.",
				trace: [],
				collision: {
					outcome: "collision",
					toolNames: ["searchWeb"],
					owners: ["workbench-component", "duplicate-provider"],
				},
			},
		});
		expect(
			bridge.host.shadowRoot?.querySelector(".collision-proof")?.textContent,
		).toContain("Capability manifest collision");
		expect(
			bridge.host.shadowRoot?.querySelector(".collision-proof")?.textContent,
		).toContain("searchWeb · workbench-component + duplicate-provider");

		bridge.stop();
		source.stop();
	});
});
