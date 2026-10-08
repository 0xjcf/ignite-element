// @vitest-environment jsdom

import { within } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { createAppShellCore } from "./app-shell.core";
import { appShellView } from "./app-shell.view";

const TAG = "app-shell";

function register() {
	if (customElements.get(TAG)) return;
	createAppShellCore()(TAG, appShellView);
}

function mount(route: string) {
	register();
	const element = document.createElement(TAG) as HTMLElement & {
		openMenu: () => void;
		closeMenu: () => void;
		setReturnTo: (value: string | null) => void;
		setPanel: (open: string | null) => void;
		requestReturn: () => void;
	};
	element.setAttribute("route", route);
	const nav = document.createElement("a");
	nav.slot = "nav";
	nav.textContent = "Inspector";
	const main = document.createElement("p");
	main.slot = "main";
	main.textContent = "Runtime states";
	const panel = document.createElement("p");
	panel.slot = "panel";
	panel.textContent = "Detail";
	element.append(nav, main, panel);
	document.body.appendChild(element);
	const root = element.shadowRoot as unknown as HTMLElement;
	return { element, root, view: within(root), nav, main, panel };
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("AppShell DOM", () => {
	it("projects the route and the three slots", () => {
		const { view, element, nav, main, panel } = mount("Inspector");
		expect(view.getByText("Inspector")).toBeTruthy();
		const navSlot = element.shadowRoot?.querySelector(
			"slot[name='nav']",
		) as HTMLSlotElement;
		const mainSlot = element.shadowRoot?.querySelector(
			"slot[name='main']",
		) as HTMLSlotElement;
		const panelSlot = element.shadowRoot?.querySelector(
			"slot[name='panel']",
		) as HTMLSlotElement;
		expect(navSlot.assignedElements()).toEqual([nav]);
		expect(mainSlot.assignedElements()).toEqual([main]);
		expect(panelSlot.assignedElements()).toEqual([panel]);
		const navigation = element.shadowRoot?.querySelector("nav");
		const sidePanel = element.shadowRoot?.querySelector("aside");
		expect(navigation?.getAttribute("aria-label")).toBe("Primary");
		expect(navigation?.hidden).toBe(true);
		expect(sidePanel?.getAttribute("aria-label")).toBe("Side panel");
		expect(sidePanel?.hidden).toBe(true);
	});

	it("opens the menu, shows the panel, and names the return target", () => {
		const { element, view } = mount("Today");
		view.getByRole("button", { name: "Menu" }).click();
		expect(
			view
				.getByRole("button", { name: "Close menu" })
				.getAttribute("aria-expanded"),
		).toBe("true");
		expect(view.getByRole("navigation", { name: "Primary" }).hidden).toBe(
			false,
		);
		element.setPanel("true");
		expect(view.getByRole("complementary", { name: "Side panel" }).hidden).toBe(
			false,
		);
		element.setReturnTo("Capture");
		expect(view.getByRole("button", { name: "Back to Capture" })).toBeTruthy();
	});
});
