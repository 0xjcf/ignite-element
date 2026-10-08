// @vitest-environment jsdom

import { within } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { catalogColors } from "../styles";
import { contrastRatio } from "../testing/contrast";
import { createFieldCore } from "./field.core";
import { fieldView } from "./field.view";

const TAG = "catalog-field";

function mount() {
	if (!customElements.get(TAG)) {
		createFieldCore()(TAG, fieldView);
	}
	const element = document.createElement(TAG) as HTMLElement & {
		setHint: (hint: string | null) => void;
		setError: (error: string | null) => void;
		setRequired: (required: string | null) => void;
	};
	element.setAttribute("label", "Title");
	document.body.appendChild(element);
	element.setHint("Short name.");
	element.setRequired("true");
	element.setError("Title is required.");
	const root = element.shadowRoot as unknown as HTMLElement;
	return { element, view: within(root) };
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("Field accessibility", () => {
	it("names the control from the label and links the hint and error", () => {
		const { element, view } = mount();
		const control = view.getByRole("textbox", { name: /Title/ });
		expect(control.getAttribute("aria-invalid")).toBe("true");
		expect(control.getAttribute("aria-required")).toBe("true");
		expect(control.hasAttribute("disabled")).toBe(false);
		const describedBy = control.getAttribute("aria-describedby") ?? "";
		expect(describedBy).toContain("field-hint");
		expect(describedBy).toContain("field-error");
		expect(view.getByText("Required")).toBeTruthy();
		expect(view.getByText("Title is required.")).toBeTruthy();
		control.focus();
		expect(element.shadowRoot?.activeElement).toBe(control);
	});

	it("keeps field ink at WCAG AA", () => {
		expect(
			contrastRatio(catalogColors.fg, catalogColors.surface),
		).toBeGreaterThanOrEqual(4.5);
		expect(
			contrastRatio(catalogColors.danger, catalogColors.surface),
		).toBeGreaterThanOrEqual(4.5);
	});
});
