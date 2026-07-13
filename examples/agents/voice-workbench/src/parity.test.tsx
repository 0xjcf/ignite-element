// @vitest-environment jsdom
import { test as igniteTest } from "ignite-element/testing";
import { describe, expect, it } from "vitest";
import {
	createParityControls,
	PARITY_STATES,
	resolveParityState,
	seedParityState,
} from "./parity";
import paritySource from "./parity.tsx?raw";
import { component, source } from "./session";
import { renderWorkbench } from "./workbench";

describe("voice workbench production parity harness", () => {
	it("allowlists exactly the five approved states", () => {
		expect(PARITY_STATES).toEqual([
			"ready",
			"listening",
			"responding",
			"artifact",
			"permission",
		]);
		expect(resolveParityState("?state=artifact")).toBe("artifact");
		expect(resolveParityState("")).toBe("ready");
		expect(resolveParityState("?state=provider-error")).toBeNull();
		expect(resolveParityState("?state=../../main")).toBeNull();
		expect(paritySource).not.toContain("querySelector");
	});

	it("renders accessible evidence for ready, listening, responding, artifact, and permission", async () => {
		const bridge = igniteTest.accessibilityBridge(
			component,
			(projection: Parameters<typeof renderWorkbench>[0]) =>
				renderWorkbench(projection, createParityControls()),
			{ elementName: "voice-workbench-parity-accessibility" },
		);
		const shell = () => bridge.host.shadowRoot?.querySelector(".shell");

		await seedParityState("ready");
		expect(shell()?.getAttribute("data-actor-state")).toBe("ready");
		expect(shell()?.getAttribute("data-voice-state")).toBe("idle");
		expect(
			igniteTest.expectControls(bridge, [
				{ role: "textbox", name: "Prompt" },
				{ role: "button", name: "Start speech input" },
				{ role: "button", name: "Send" },
			]),
		).toHaveLength(3);
		expect(bridge.host.shadowRoot?.textContent).toContain(
			"Your first accepted artifact will appear here",
		);

		await seedParityState("listening");
		expect(shell()?.getAttribute("data-voice-state")).toBe("listening");
		expect(
			igniteTest.expectControls(bridge, [
				{ role: "button", name: "Cancel" },
				{ role: "button", name: "Use transcript" },
			]),
		).toHaveLength(2);
		expect(bridge.host.shadowRoot?.textContent).toContain("Listening…");

		await seedParityState("responding");
		expect(shell()?.getAttribute("data-actor-state")).toBe("responding");
		expect(
			bridge.host.shadowRoot?.querySelector(".responding-overlay")?.textContent,
		).toContain("Authoring the semantic artifact");
		expect(component.getView().lastFact).toMatchObject({
			type: "prompt-submitted",
		});
		expect(component.getView()).toMatchObject({
			presentation: { mobilePanel: "artifact" },
		});

		await seedParityState("artifact");
		expect(shell()?.getAttribute("data-actor-state")).toBe("ready");
		expect(bridge.host.shadowRoot?.textContent).toContain(
			"Parity harness only — semantic artifact",
		);
		expect(bridge.host.shadowRoot?.textContent).toContain(
			"Deterministic parity content; never production seed data.",
		);
		expect(
			igniteTest.expectControls(bridge, [
				{ role: "tab", name: "Document" },
				{ role: "tab", name: "Schema" },
				{ role: "button", name: "Play spoken summary" },
			]),
		).toHaveLength(3);
		expect(component.getView()).toMatchObject({
			artifacts: [{ id: "parity-artifact", revision: "1" }],
			presentation: {
				documentCommit: { id: "parity-artifact", revision: "1" },
				mobilePanel: "artifact",
			},
		});

		await seedParityState("permission");
		expect(shell()?.getAttribute("data-voice-state")).toBe("permission");
		expect(bridge.getByRole("alert").textContent).toContain(
			"Microphone access was denied",
		);
		const prompt = bridge.getByRole("textbox", { name: "Prompt" });
		expect(prompt).toBeInstanceOf(HTMLTextAreaElement);
		expect((prompt as HTMLTextAreaElement).value).toBe(
			"Parity harness draft stays available",
		);

		bridge.stop();
		source.stop();
	});
});
