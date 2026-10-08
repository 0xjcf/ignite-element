// @vitest-environment jsdom

import { within } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { catalogColors } from "../styles";
import { contrastRatio } from "../testing/contrast";
import { createTabsCore } from "./tabs.core";
import { tabsView } from "./tabs.view";

const TAG = "catalog-tabs";

function mount() {
	if (!customElements.get(TAG)) {
		createTabsCore()(TAG, tabsView);
	}
	const element = document.createElement(TAG) as HTMLElement & {
		setItems: (items: string | null) => void;
		select: (id: string | null) => void;
	};
	element.setAttribute("label", "DevTools panels");
	document.body.appendChild(element);
	element.setItems("Contract\nGallery\nControls");
	element.select("Gallery");
	const root = element.shadowRoot as unknown as HTMLElement;
	return { element, root, view: within(root) };
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("Tabs accessibility", () => {
	it("names the tablist and moves focus with the arrow keys", () => {
		const { element, root, view } = mount();
		const list = root.querySelector("[role='tablist']");
		expect(list?.getAttribute("aria-label")).toBe("DevTools panels");
		const gallery = view.getByRole("tab", { name: "Gallery" });
		expect(gallery.getAttribute("aria-selected")).toBe("true");
		gallery.focus();
		const press = (key: string) => {
			list?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
		};
		press("ArrowRight");
		const controls = view.getByRole("tab", { name: "Controls" });
		expect(controls.getAttribute("aria-selected")).toBe("true");
		expect(element.shadowRoot?.activeElement).toBe(controls);
		press("ArrowLeft");
		expect(element.shadowRoot?.activeElement).toBe(
			view.getByRole("tab", { name: "Gallery" }),
		);
		press("Home");
		expect(element.shadowRoot?.activeElement).toBe(
			view.getByRole("tab", { name: "Contract" }),
		);
		press("End");
		expect(element.shadowRoot?.activeElement).toBe(
			view.getByRole("tab", { name: "Controls" }),
		);
		expect(
			element.shadowRoot?.querySelector("[aria-hidden='true']"),
		).toBeNull();
	});

	it("does not leave focus on a tab that was renamed by a list change", () => {
		const { element, view } = mount();
		const gallery = view.getByRole("tab", { name: "Gallery" });
		gallery.focus();
		expect(element.shadowRoot?.activeElement).toBe(gallery);
		element.setItems("Notes\nGallery");
		expect(element.shadowRoot?.activeElement).not.toBe(
			view.getByRole("tab", { name: "Notes" }),
		);
	});

	it("keeps tab ink on both fills at WCAG AA", () => {
		expect(
			contrastRatio(catalogColors.fg, catalogColors.surface),
		).toBeGreaterThanOrEqual(4.5);
		expect(
			contrastRatio(catalogColors.surface, catalogColors.fg),
		).toBeGreaterThanOrEqual(4.5);
	});
});
