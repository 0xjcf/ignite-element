// @vitest-environment jsdom

import { within } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { createTabsCore } from "./tabs.core";
import { tabsGallery } from "./tabs.gallery";
import { tabsView } from "./tabs.view";

const TAG = "catalog-tabs";

function register() {
	if (customElements.get(TAG)) return;
	createTabsCore()(TAG, tabsView);
}

function mount(label: string) {
	register();
	const element = document.createElement(TAG) as HTMLElement & {
		setItems: (items: string | null) => void;
		setActive: (active: string | null) => void;
		select: (id: string | null) => void;
	};
	element.setAttribute("label", label);
	document.body.appendChild(element);
	const root = element.shadowRoot as unknown as HTMLElement;
	return { element, root, view: within(root) };
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("Tabs DOM", () => {
	it("shows each gallery tab and which one is selected", () => {
		for (const fixture of tabsGallery) {
			document.body.innerHTML = "";
			const { element, view } = mount(fixture.input.label);
			element.setItems(fixture.input.items);
			element.setActive(fixture.input.active);
			if (fixture.input.items.trim().length === 0) {
				expect(view.getByText("There are no tabs.")).toBeTruthy();
				continue;
			}
			for (const name of fixture.input.items.split("\n")) {
				const tab = view.getByRole("tab", { name });
				expect(tab.getAttribute("aria-selected")).toBe(
					name === fixture.input.active ? "true" : "false",
				);
			}
		}
	});

	it("emits select and does not invent a panel", () => {
		const { element, view } = mount("DevTools panels");
		element.setItems("Contract\nGallery\nControls");
		const selected: string[] = [];
		element.addEventListener("select", (event) => {
			selected.push((event as CustomEvent<{ id: string }>).detail.id);
		});
		view.getByRole("tab", { name: "Controls" }).click();
		view.getByRole("tab", { name: "Controls" }).click();
		expect(selected).toEqual(["Controls", "Controls"]);
		expect(
			view.getByRole("tab", { name: "Controls" }).getAttribute("aria-selected"),
		).toBe("true");
		expect(element.shadowRoot?.querySelector("[role='tabpanel']")).toBeNull();
	});
});
