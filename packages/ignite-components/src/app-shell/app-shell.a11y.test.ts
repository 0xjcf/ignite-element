// @vitest-environment jsdom

import { within } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { catalogColors } from "../styles";
import { contrastRatio } from "../testing/contrast";
import { createAppShellCore } from "./app-shell.core";
import { appShellView } from "./app-shell.view";

const TAG = "app-shell";

function mount() {
	if (!customElements.get(TAG)) {
		createAppShellCore()(TAG, appShellView);
	}
	const element = document.createElement(TAG) as HTMLElement & {
		setReturnTo: (value: string | null) => void;
	};
	element.setAttribute("route", "Today");
	const body = document.createElement("p");
	body.slot = "main";
	body.textContent = "Capacity 0/3";
	element.append(body);
	document.body.appendChild(element);
	const root = element.shadowRoot as unknown as HTMLElement;
	return { element, view: within(root) };
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("AppShell accessibility", () => {
	it("moves focus to main from the skip link and closes the menu on Escape", () => {
		const { element, view } = mount();
		const skip = view.getByRole("link", { name: "Skip to main content" });
		const main = element.shadowRoot?.querySelector("main") as HTMLElement;
		expect(main.tabIndex).toBe(-1);
		skip.click();
		expect(element.shadowRoot?.activeElement).toBe(main);

		const menu = view.getByRole("button", { name: "Menu" });
		expect(menu.getAttribute("aria-expanded")).toBe("false");
		expect(menu.getAttribute("aria-controls")).toBe("nav");
		menu.click();
		const close = view.getByRole("button", { name: "Close menu" });
		close.focus();
		element.shadowRoot
			?.querySelector(".shell")
			?.dispatchEvent(
				new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
			);
		expect(
			view.getByRole("button", { name: "Menu" }).getAttribute("aria-expanded"),
		).toBe("false");
	});

	it("names the return control with the target", () => {
		const { element, view } = mount();
		element.setReturnTo("Capture");
		const back = view.getByRole("button", { name: "Back to Capture" });
		expect(back.hasAttribute("disabled")).toBe(false);
		expect(back.getAttribute("aria-disabled")).not.toBe("true");
		back.focus();
		expect(element.shadowRoot?.activeElement).toBe(back);
	});

	it("keeps bar ink at WCAG AA", () => {
		expect(
			contrastRatio(catalogColors.fg, catalogColors.surface),
		).toBeGreaterThanOrEqual(4.5);
		expect(
			contrastRatio(catalogColors.surface, catalogColors.fg),
		).toBeGreaterThanOrEqual(4.5);
	});
});
