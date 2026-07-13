// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("voice workbench browser entry", () => {
	const speak = vi.fn();

	beforeEach(() => {
		speak.mockReset();
		vi.stubGlobal(
			"SpeechSynthesisUtterance",
			class SpeechSynthesisUtterance {
				constructor(readonly text: string) {}
			},
		);
		Object.defineProperty(window, "speechSynthesis", {
			configurable: true,
			value: { speak },
		});
		document.body.innerHTML = `
			<voice-workbench></voice-workbench>
			<output id="document-commit"></output>
			<output id="speech-commit"></output>
		`;
	});

	it("runs a deterministic prompt through direct Ignite projections", async () => {
		await import("./main");
		const { component, source } = await import("./session");
		const host = document.querySelector("voice-workbench");
		if (!(host instanceof HTMLElement) || !host.shadowRoot) {
			throw new Error("voice workbench did not mount");
		}

		const prompt = host.shadowRoot.querySelector("textarea");
		const form = host.shadowRoot.querySelector("form");
		if (
			!(prompt instanceof HTMLTextAreaElement) ||
			!(form instanceof HTMLFormElement)
		) {
			throw new Error("voice workbench form is unavailable");
		}
		prompt.value = "Capture the browser demo";
		form.dispatchEvent(
			new Event("submit", { bubbles: true, cancelable: true }),
		);

		await vi.waitFor(() => {
			expect(component.getView()).toMatchObject({
				status: "ready",
				artifacts: [
					{
						id: "browser-demo",
						title: "Browser demo",
						revision: "1",
					},
				],
			});
			expect(document.querySelector("#document-commit")?.textContent).toBe(
				"Committed Browser demo revision 1",
			);
			expect(document.querySelector("#speech-commit")?.textContent).toBe(
				"Captured: Capture the browser demo",
			);
			expect(speak).toHaveBeenCalledWith(
				expect.objectContaining({
					text: "Captured: Capture the browser demo",
				}),
			);
		});

		expect(host.shadowRoot.querySelector('[role="status"]')?.textContent).toBe(
			"Ready",
		);

		prompt.value = "Revise the browser demo";
		form.dispatchEvent(
			new Event("submit", { bubbles: true, cancelable: true }),
		);
		await vi.waitFor(() => {
			expect(component.getView()).toMatchObject({
				status: "ready",
				artifacts: [
					{
						id: "browser-demo",
						title: "Browser demo",
						revision: "2",
					},
				],
			});
			expect(document.querySelector("#document-commit")?.textContent).toBe(
				"Committed Browser demo revision 2",
			);
			expect(document.querySelector("#speech-commit")?.textContent).toBe(
				"Captured: Revise the browser demo",
			);
			expect(speak).toHaveBeenLastCalledWith(
				expect.objectContaining({
					text: "Captured: Revise the browser demo",
				}),
			);
			expect(speak).toHaveBeenCalledTimes(2);
		});

		const persistedPagehide = new Event("pagehide");
		Object.defineProperty(persistedPagehide, "persisted", { value: true });
		window.dispatchEvent(persistedPagehide);
		expect(source.getSnapshot().status).toBe("active");
		window.dispatchEvent(new Event("pagehide"));
		expect(source.getSnapshot().status).toBe("stopped");
	});
});
