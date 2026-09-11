// @vitest-environment jsdom
import { within } from "@testing-library/dom";
import { describe, expect, it } from "vitest";
import {
	parityComponent as component,
	PARITY_STATES,
	resolveParityState,
	seedParityState,
	paritySource as source,
} from "./parity";
import paritySource from "./parity.tsx?raw";
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
		expect(paritySource).not.toContain('type: "TURN_COMPLETED"');
		expect(paritySource).not.toContain('type: "MODEL_AVAILABLE"');
		expect(paritySource).not.toContain("presentVoice");
		expect(paritySource).not.toContain("recordVoiceCaptureLifecycle");
		expect(paritySource).toContain("MODEL_TURN_PORT_RECEIVED");
	});

	it("renders accessible evidence across provider, turn, artifact, and voice lifecycles", async () => {
		component("voice-workbench-parity-accessibility", renderWorkbench);
		const host = document.createElement("voice-workbench-parity-accessibility");
		document.body.appendChild(host);
		try {
			const root = host.shadowRoot;
			if (!root) throw new Error("Expected registered component shadow root");
			const container = root.querySelector<HTMLElement>(".shell");
			if (!container) throw new Error("Expected rendered workbench shell");
			const queries = within(container);
			const shell = () => host.shadowRoot?.querySelector(".shell");

			await seedParityState("preparing");
			expect(shell()?.getAttribute("data-actor-state")).toBe("preparing");
			expect(host.shadowRoot?.textContent).toContain(
				"Preparing the local MLX model",
			);
			expect(
				(
					queries.getByRole("textbox", {
						name: "Prompt",
					}) as HTMLTextAreaElement
				).disabled,
			).toBe(true);

			await seedParityState("failed");
			expect(shell()?.getAttribute("data-actor-state")).toBe("failed");
			expect(host.shadowRoot?.textContent).toContain(
				"Parity harness only — simulated model failure.",
			);
			expect([
				queries.getByRole("button", { name: "Retry model" }),
			]).toHaveLength(1);

			await seedParityState("ready");
			expect(shell()?.getAttribute("data-actor-state")).toBe("ready");
			expect(shell()?.getAttribute("data-voice-state")).toBe("idle");
			expect(
				source.getSnapshot().context.childLifecycles.voiceCapture,
			).toMatchObject({ state: "idle", fact: { type: "voice-idle" } });
			expect(
				(
					queries.getByRole("button", {
						name: "Start speech input",
					}) as HTMLButtonElement
				).disabled,
			).toBe(false);
			expect([
				queries.getByRole("textbox", { name: "Prompt" }),
				queries.getByRole("button", { name: "Start speech input" }),
				queries.getByRole("button", { name: "Send" }),
			]).toHaveLength(3);
			expect(host.shadowRoot?.textContent).toContain(
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
			expect([
				queries.getByRole("button", { name: "Cancel" }),
				queries.getByRole("button", { name: "Use transcript" }),
			]).toHaveLength(2);
			expect(host.shadowRoot?.textContent).toContain("Listening…");

			await seedParityState("responding");
			expect(shell()?.getAttribute("data-actor-state")).toBe("responding");
			expect(
				host.shadowRoot?.querySelector(".responding-overlay")?.textContent,
			).toContain("Completing the authorized turn");
			expect(
				host.shadowRoot?.querySelector(".responding-overlay")?.textContent,
			).toContain("Awaiting the first model or capability result");
			expect(component.get("states").lastFact).toMatchObject({
				type: "prompt-submitted",
			});
			expect(component.get("states")).toMatchObject({
				presentation: { mobilePanel: "artifact" },
			});

			await seedParityState("artifact");
			expect(shell()?.getAttribute("data-actor-state")).toBe("ready");
			expect(host.shadowRoot?.textContent).toContain(
				"Parity harness only — semantic artifact",
			);
			expect(host.shadowRoot?.textContent).toContain(
				"Deterministic parity content; never production seed data.",
			);
			expect([
				queries.getByRole("tab", { name: "Document" }),
				queries.getByRole("tab", { name: "Schema" }),
				queries.getByRole("button", { name: "Play spoken summary" }),
			]).toHaveLength(3);
			expect(component.get("states")).toMatchObject({
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
			expect(queries.getByRole("alert").textContent).toContain(
				"Microphone access was denied",
			);
			const prompt = queries.getByRole("textbox", { name: "Prompt" });
			expect(prompt).toBeInstanceOf(HTMLTextAreaElement);
			expect((prompt as HTMLTextAreaElement).value).toBe(
				"Parity harness draft stays available",
			);
		} finally {
			host.remove();
			await new Promise<void>((resolve) => queueMicrotask(resolve));
			source.stop();
		}
		expect(host.isConnected).toBe(false);
	});
});
