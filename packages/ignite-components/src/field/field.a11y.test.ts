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
		setValue: (value: string | null) => void;
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
		const hint = view.getByText("Short name.");
		const error = view.getByRole("alert");
		expect(view.getAllByText("Title is required.")).toHaveLength(1);
		expect(describedBy).toContain(hint.id);
		expect(describedBy).toContain(error.id);
		expect(hint.id).not.toBe("field-hint");
		expect(view.getByRole("alert").textContent).toContain("Title is required.");
		expect(view.getByText("Required")).toBeTruthy();
		control.focus();
		expect(element.shadowRoot?.activeElement).toBe(control);
	});

	it("announces the error when it is set and when it is cleared", () => {
		const { element, view } = mount();
		const host = element as HTMLElement & {
			setError: (error: string | null) => void;
		};
		expect(view.getByRole("alert").textContent).toContain("Title is required.");
		host.setError(null);
		expect(view.queryByText("Title is required.")).toBeNull();
		expect(view.getByRole("alert").textContent).toContain("Error cleared.");
		host.setError("Title is required.");
		const second = document.createElement(TAG) as HTMLElement & {
			setHint: (hint: string | null) => void;
			setError: (error: string | null) => void;
		};
		second.setAttribute("label", "Payee");
		document.body.appendChild(second);
		second.setHint("Who was paid.");
		second.setError("Payee is required.");
		const firstHint = view.getByText("Short name.");
		const secondRoot = second.shadowRoot as unknown as HTMLElement;
		const secondHint = within(secondRoot).getByText("Who was paid.");
		expect(firstHint.id).not.toBe(secondHint.id);
		expect(
			view.getByRole("textbox").getAttribute("aria-describedby"),
		).not.toContain(secondHint.id);
	});

	it("repeats the same error after the draft changes", async () => {
		const { element, view } = mount();
		const host = element;
		const alert = view.getByRole("alert");
		expect(alert.textContent).toContain("Title is required.");
		host.setValue("Buy milk");
		host.setError("Title is required.");
		expect(alert.textContent ?? "").not.toContain("Title is required.");
		await new Promise<void>((resolve) => {
			queueMicrotask(() => resolve());
		});
		expect(view.getAllByText("Title is required.")).toHaveLength(1);
		expect(alert.textContent).toContain("Title is required.");
	});

	it("keeps an initial error out of the first paint", async () => {
		if (!customElements.get(TAG)) {
			createFieldCore()(TAG, fieldView);
		}
		const element = document.createElement(TAG);
		element.setAttribute("label", "Title");
		element.setAttribute("error", "Title is required.");
		document.body.appendChild(element);
		const root = element.shadowRoot as unknown as HTMLElement;
		const alert = root.querySelector("[role='alert']");
		expect(alert?.textContent ?? "").not.toContain("Title is required.");
		await new Promise<void>((resolve) => {
			queueMicrotask(() => resolve());
		});
		expect(alert?.textContent).toContain("Title is required.");
		expect(within(root).getAllByText("Title is required.")).toHaveLength(1);
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
