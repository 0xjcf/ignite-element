// @vitest-environment jsdom
import { test as igniteTest } from "ignite-element/testing";
import { describe, expect, it } from "vitest";
import { component, source } from "./session";
import { renderWorkbench } from "./workbench";

describe("voice workbench accessible JSX", () => {
	it("projects prompts, status, documents, and command actions to native controls", async () => {
		const bridge = igniteTest.accessibilityBridge(component, renderWorkbench, {
			elementName: "voice-workbench-accessibility",
		});

		expect(
			igniteTest.expectControls(bridge, [
				{ role: "status", name: "Conversation status", text: "Ready" },
				{ role: "textbox", name: "Prompt" },
				{ role: "button", name: "Send text prompt" },
				{ role: "button", name: "Send speech prompt" },
			]),
		).toHaveLength(4);

		await component.execute({
			command: "submitPrompt",
			input: { modality: "text", text: "Show the decision" },
		});
		await component.execute({
			command: "createArtifact",
			input: {
				id: "decision",
				title: "Decision",
				nodes: [
					{
						kind: "text",
						id: "summary",
						text: "Ignite owns the projection.",
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

		const heading = bridge.host.shadowRoot?.querySelector("h2");
		const action = bridge.getByRole("button", { name: "Complete response" });
		expect(heading?.textContent).toBe("Decision");
		action.focus();
		expect(bridge.root.activeElement).toBe(action);
		action.click();
		expect(component.getView().status).toBe("ready");

		bridge.stop();
		source.stop();
	});
});
