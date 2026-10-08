// @vitest-environment jsdom

import { within } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { createFieldCore } from "./field.core";
import { fieldGallery } from "./field.gallery";
import { fieldView } from "./field.view";

const TAG = "catalog-field";

function register() {
	if (customElements.get(TAG)) return;
	createFieldCore()(TAG, fieldView);
}

function mount(label: string) {
	register();
	const element = document.createElement(TAG) as HTMLElement & {
		setValue: (value: string | null) => void;
		setHint: (hint: string | null) => void;
		setError: (error: string | null) => void;
		setRequired: (required: string | null) => void;
		setMultiline: (multiline: string | null) => void;
	};
	element.setAttribute("label", label);
	document.body.appendChild(element);
	const root = element.shadowRoot as unknown as HTMLElement;
	return { element, view: within(root) };
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("Field DOM", () => {
	it("shows each gallery label, draft, hint, and linked error", () => {
		for (const fixture of fieldGallery) {
			document.body.innerHTML = "";
			const { element, view } = mount(fixture.input.label);
			element.setValue(fixture.input.value);
			element.setHint(fixture.input.hint);
			element.setError(fixture.input.error);
			element.setRequired(fixture.input.required ? "true" : "false");
			element.setMultiline(fixture.input.multiline ? "true" : "false");
			const control = (
				fixture.input.multiline
					? view.getByRole("textbox", { name: new RegExp(fixture.input.label) })
					: view.getByRole("textbox", { name: new RegExp(fixture.input.label) })
			) as HTMLInputElement | HTMLTextAreaElement;
			expect(control.value).toBe(fixture.input.value);
			expect(control.getAttribute("aria-invalid")).toBe(
				fixture.input.error ? "true" : "false",
			);
			if (fixture.input.hint) {
				expect(view.getByText(fixture.input.hint)).toBeTruthy();
			}
			if (fixture.input.error) {
				const error = view.getByText(fixture.input.error);
				expect(control.getAttribute("aria-describedby")).toContain(error.id);
			}
		}
	});

	it("writes the exact keystrokes and does not clear a host error", () => {
		const { element, view } = mount("Title");
		element.setError("Title is required.");
		const control = view.getByRole("textbox") as HTMLInputElement;
		control.value = "  Buy milk  ";
		control.dispatchEvent(new Event("input", { bubbles: true }));
		expect(control.value).toBe("  Buy milk  ");
		expect(view.getByText("Title is required.")).toBeTruthy();
		element.setError(null);
		expect(view.queryByText("Title is required.")).toBeNull();
	});
});
