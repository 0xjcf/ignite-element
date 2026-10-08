// @vitest-environment jsdom

import { within } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { catalogColors } from "../styles";
import { contrastRatio } from "../testing/contrast";
import { createActionButtonCore } from "./action-button.core";
import { actionButtonView } from "./action-button.view";

const TAG = "action-button";

function mount() {
	if (!customElements.get(TAG)) {
		createActionButtonCore()(TAG, actionButtonView);
	}
	const element = document.createElement(TAG) as HTMLElement & {
		refuse: (reason: string | null) => void;
		setPendingLabel: (value: string | null) => void;
	};
	element.setAttribute("label", "Add to Today");
	document.body.appendChild(element);
	element.setPendingLabel("Adding…");
	const root = element.shadowRoot as unknown as HTMLElement;
	return {
		element,
		view: within(root),
	};
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("ActionButton accessibility", () => {
	it("keeps an unavailable button focusable and the reason reachable", () => {
		const { element, view } = mount();
		element.refuse("Today is full (3/3).");
		const button = view.getByRole("button", { name: "Add to Today" });
		const reason = view.getByText("Today is full (3/3).");

		expect(button.getAttribute("aria-disabled")).toBe("true");
		expect(button.hasAttribute("disabled")).toBe(false);
		expect(button.getAttribute("aria-describedby")).toBe("action-reason");
		expect(reason.id).toBe("action-reason");
		expect(reason.getAttribute("tabindex")).toBe("0");
		expect(reason.getAttribute("aria-hidden")).not.toBe("true");

		button.focus();
		expect(element.shadowRoot?.activeElement).toBe(button);
		reason.focus();
		expect(element.shadowRoot?.activeElement).toBe(reason);

		button.click();
		expect(view.getByRole("button", { name: "Add to Today" })).toBeTruthy();
		expect(view.queryByRole("button", { name: "Adding…" })).toBeNull();
	});

	it("keeps button ink on both fills at WCAG AA", () => {
		expect(
			contrastRatio(catalogColors.surface, catalogColors.fg),
		).toBeGreaterThanOrEqual(4.5);
		expect(
			contrastRatio(catalogColors.fg, catalogColors.surface),
		).toBeGreaterThanOrEqual(4.5);
	});
});
