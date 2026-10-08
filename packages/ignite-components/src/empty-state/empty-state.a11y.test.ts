// @vitest-environment jsdom

import { within } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { catalogColors } from "../styles";
import { contrastRatio } from "../testing/contrast";
import { createEmptyStateCore } from "./empty-state.core";
import { emptyStateView } from "./empty-state.view";

const TAG = "empty-state";

function mount() {
	if (!customElements.get(TAG)) {
		createEmptyStateCore()(TAG, emptyStateView);
	}
	const element = document.createElement(TAG) as HTMLElement & {
		setActionLabel: (label: string | null) => void;
	};
	element.setAttribute("title", "Today is empty");
	element.setAttribute("message", "Capacity 0/3.");
	document.body.appendChild(element);
	element.setActionLabel("Add a thought");
	const root = element.shadowRoot as unknown as HTMLElement;
	return { element, view: within(root) };
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("EmptyState accessibility", () => {
	it("names the region from the heading and keeps the step focusable", () => {
		const { element, view } = mount();
		const region = element.shadowRoot?.querySelector("section");
		expect(region?.getAttribute("aria-labelledby")).toBe("empty-title");
		const step = view.getByRole("button", { name: "Add a thought" });
		expect(step.hasAttribute("disabled")).toBe(false);
		step.focus();
		expect(element.shadowRoot?.activeElement).toBe(step);
		expect(view.getByText("Nothing here yet")).toBeTruthy();
	});

	it("keeps the message ink at WCAG AA", () => {
		expect(
			contrastRatio(catalogColors.fg, catalogColors.surface),
		).toBeGreaterThanOrEqual(4.5);
		expect(
			contrastRatio(catalogColors.surface, catalogColors.fg),
		).toBeGreaterThanOrEqual(4.5);
	});
});
