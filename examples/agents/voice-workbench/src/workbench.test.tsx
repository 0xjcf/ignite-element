// @vitest-environment jsdom
import { test as igniteTest } from "ignite-element/testing";
import { describe, expect, it, vi } from "vitest";
import { component, source } from "./session";
import { renderWorkbench } from "./workbench";

describe("voice workbench accessible JSX", () => {
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
		).toContain("Ready");
		expect(bridge.host.shadowRoot?.textContent).toContain(
			"Your first accepted artifact will appear here",
		);
		expect(bridge.host.shadowRoot?.textContent).toContain("0 turns");
		expect(bridge.host.shadowRoot?.textContent).toContain("0 artifacts");
		expect(bridge.host.shadowRoot?.textContent).not.toContain("browser-demo");

		const promptEvent = vi.fn();
		bridge.host.addEventListener("workbench-prompt", promptEvent);
		const prompt = bridge.getByRole("textbox", { name: "Prompt" });
		const form = prompt.closest("form");
		if (
			!(prompt instanceof HTMLTextAreaElement) ||
			!(form instanceof HTMLFormElement)
		) {
			throw new Error("workbench prompt form is unavailable");
		}
		prompt.value = "Show the decision";
		form.dispatchEvent(
			new Event("submit", { bubbles: true, cancelable: true }),
		);
		expect(promptEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: { channel: "text", text: "Show the decision" },
			}),
		);
		expect(component.getView().status).toBe("ready");

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

		expect(bridge.host.shadowRoot?.textContent).toContain("Text prompt");
		expect(bridge.host.shadowRoot?.textContent).toContain("Show the decision");
		expect(bridge.host.shadowRoot?.textContent).toContain(
			"Ignite owns the projection.",
		);
		expect(bridge.host.shadowRoot?.textContent).toContain(
			"decision · revision 1",
		);

		const schemaTab = bridge.getByRole("tab", { name: "Schema" });
		schemaTab.click();
		expect(schemaTab.getAttribute("aria-selected")).toBe("true");
		expect(
			bridge.host.shadowRoot?.querySelector(".schema-view")?.textContent,
		).toContain('"revision": "1"');

		const action = bridge.getByRole("button", { name: "Complete response" });
		action.focus();
		expect(bridge.root.activeElement).toBe(action);
		action.click();
		expect(component.getView().status).toBe("ready");

		bridge.stop();
		source.stop();
	});
});
