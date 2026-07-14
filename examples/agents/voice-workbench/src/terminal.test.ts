import { afterAll, describe, expect, it } from "vitest";
import { component, source } from "./session";
import { formatTerminalProjection } from "./terminal";
import terminalSource from "./terminal.ts?raw";

afterAll(() => source.stop());

describe("voice workbench terminal projection", () => {
	it("formats the same actor-approved view without DOM APIs", async () => {
		await component.execute({ command: "reportModelAvailable" });
		await component.execute({
			command: "submitPrompt",
			input: { modality: "text", text: "Create a terminal artifact" },
		});
		await component.execute({
			command: "createArtifact",
			input: {
				id: "terminal-artifact",
				title: "Terminal artifact",
				nodes: [
					{
						id: "summary",
						kind: "text",
						text: "Projected without a DOM.",
					},
				],
			},
		});
		await component.execute({
			command: "completeResponse",
			input: { text: "Terminal artifact ready." },
		});

		const output = formatTerminalProjection(component.getView());
		expect(output).toContain('provider: "available"');
		expect(output).toContain('turn: "ready"');
		expect(output).toContain(
			"Terminal artifact [terminal-artifact] · revision 1",
		);
		expect(output).toContain("text · summary");
		expect(output).toContain("Terminal artifact ready.");
		expect(terminalSource).not.toMatch(/document|window|HTMLElement/);
	});
});
