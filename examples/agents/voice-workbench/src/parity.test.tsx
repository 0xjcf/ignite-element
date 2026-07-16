// @vitest-environment jsdom
import { test as igniteTest } from "ignite-element/testing";
import { describe, expect, it } from "vitest";
import { PARITY_STATES, resolveParityState, seedParityState } from "./parity";
import paritySource from "./parity.tsx?raw";
import { component, source } from "./session";
import { renderWorkbench } from "./workbench";

describe("voice workbench production parity harness", () => {
	it("allowlists the approved provider, turn, artifact, and voice states", () => {
		expect(PARITY_STATES).toEqual([
			"preparing",
			"failed",
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
		expect(paritySource).not.toContain("createParityEnvironment");
		expect(paritySource).not.toContain("parityEnvironment");
		expect(paritySource).not.toContain("source.send");
		expect(paritySource).not.toContain("presentVoice");
		expect(paritySource).toContain("recordVoiceCaptureLifecycle");
	});

	it("renders accessible evidence across provider, turn, artifact, and voice lifecycles", async () => {
		const bridge = igniteTest.accessibilityBridge(component, renderWorkbench, {
			elementName: "voice-workbench-parity-accessibility",
		});
		const shell = () => bridge.host.shadowRoot?.querySelector(".shell");

		await seedParityState("preparing");
		expect(shell()?.getAttribute("data-actor-state")).toBe("preparing");
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

		await seedParityState("failed");
		expect(shell()?.getAttribute("data-actor-state")).toBe("failed");
		expect(bridge.host.shadowRoot?.textContent).toContain(
			"Parity harness only — simulated model failure.",
		);
		expect(
			igniteTest.expectControls(bridge, [
				{ role: "button", name: "Retry model" },
			]),
		).toHaveLength(1);

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
			source.getSnapshot().context.childLifecycles.voiceCapture,
		).toMatchObject({
			state: "listening",
			fact: { type: "voice-listening" },
		});
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
		).toContain("Completing the authorized turn");
		expect(
			bridge.host.shadowRoot?.querySelector(".responding-overlay")?.textContent,
		).toContain("Awaiting the first model or capability result");
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
				speechDelivery: {
					type: "speech-delivery-unavailable",
				},
				speechCommit: { status: "unavailable" },
			},
		});
		expect(
			source.getSnapshot().context.childLifecycles.speechDelivery,
		).toMatchObject({
			state: "unavailable",
			requestSequence: expect.any(Number),
			fact: { type: "speech-delivery-unavailable" },
			terminal: { type: "speech-delivery-unavailable" },
		});
		expect(source.getSnapshot().context.presentation).not.toHaveProperty(
			"speechDelivery",
		);
		expect(source.getSnapshot().context.presentation).not.toHaveProperty(
			"speechCommit",
		);

		await seedParityState("permission");
		expect(shell()?.getAttribute("data-voice-state")).toBe("permission");
		expect(
			source.getSnapshot().context.childLifecycles.voiceCapture,
		).toMatchObject({
			state: "permission-denied",
			fact: { type: "voice-permission-denied" },
		});
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
