// @vitest-environment jsdom

import { within } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { catalogColors } from "../styles";
import { contrastRatio } from "../testing/contrast";
import { createFilterBarCore } from "./filter-bar.core";
import { filterBarView } from "./filter-bar.view";

const TAG = "catalog-filter-bar";

function mount() {
	if (!customElements.get(TAG)) {
		createFilterBarCore()(TAG, filterBarView);
	}
	const element = document.createElement(TAG) as HTMLElement & {
		setFilters: (filters: string | null) => void;
		setActive: (active: string | null) => void;
	};
	element.setAttribute("label", "Filter the event log");
	document.body.appendChild(element);
	element.setFilters("Type\nSurface\nRuntime");
	element.setActive("Type");
	const root = element.shadowRoot as unknown as HTMLElement;
	return { element, view: within(root) };
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("FilterBar accessibility", () => {
	it("names the query and presses a chip in text", () => {
		const { view } = mount();
		const box = view.getByRole("searchbox", { name: "Filter the event log" });
		expect(box.getAttribute("aria-hidden")).not.toBe("true");
		expect(
			view.getByRole("button", { name: "Type" }).getAttribute("aria-pressed"),
		).toBe("true");
		expect(view.getByRole("button", { name: "Clear filters" })).toBeTruthy();
	});

	it("does not leave focus on a chip that was renamed by a new list", () => {
		const { element, view } = mount();
		const type = view.getByRole("button", { name: "Type" });
		type.focus();
		expect(element.shadowRoot?.activeElement).toBe(type);
		element.setFilters("Status\nSurface");
		expect(element.shadowRoot?.activeElement).not.toBe(
			view.getByRole("button", { name: "Status" }),
		);
	});

	it("keeps chip ink on both fills at WCAG AA", () => {
		expect(
			contrastRatio(catalogColors.fg, catalogColors.surface),
		).toBeGreaterThanOrEqual(4.5);
		expect(
			contrastRatio(catalogColors.surface, catalogColors.fg),
		).toBeGreaterThanOrEqual(4.5);
	});
});
