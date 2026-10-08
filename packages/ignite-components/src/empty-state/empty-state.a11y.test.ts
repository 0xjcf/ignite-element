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
		const title = view.getByRole("heading", { name: "Today is empty" });
		expect(region?.getAttribute("aria-labelledby")).toBe(title.id);
		expect(title.id).not.toBe("empty-title");
		const step = view.getByRole("button", { name: "Add a thought" });
		expect(step.hasAttribute("disabled")).toBe(false);
		step.focus();
		expect(element.shadowRoot?.activeElement).toBe(step);
		expect(view.getByText("Nothing here yet")).toBeTruthy();
	});

	it("moves focus once and does not collide with a second empty state", () => {
		const { element, view } = mount();
		const next = document.createElement("button");
		next.id = "after-empty";
		next.textContent = "Continue";
		document.body.appendChild(next);
		const host = element as unknown as HTMLElement & {
			setFocustarget: (target: string | null) => void;
		};
		host.setFocustarget("after-empty");
		const labels: string[] = [];
		element.addEventListener("act", (event) => {
			labels.push((event as CustomEvent<{ label: string }>).detail.label);
		});
		const step = view.getByRole("button", { name: "Add a thought" });
		step.click();
		step.click();
		expect(labels).toEqual(["Add a thought"]);
		expect(document.activeElement).toBe(next);

		const other = document.createElement(TAG) as HTMLElement & {
			setActionLabel: (label: string | null) => void;
		};
		other.setAttribute("title", "Log is empty");
		other.setAttribute("message", "Nothing recorded.");
		document.body.appendChild(other);
		other.setActionLabel("Clear filters");
		const otherTitle = within(
			other.shadowRoot as unknown as HTMLElement,
		).getByRole("heading", { name: "Log is empty" });
		expect(otherTitle.id).not.toBe(
			view.getByRole("heading", { name: "Today is empty" }).id,
		);
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
