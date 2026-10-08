// @vitest-environment jsdom

import { within } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { catalogColors } from "../styles";
import { contrastRatio } from "../testing/contrast";
import { createExportButtonCore } from "./export-button.core";
import { exportButtonView } from "./export-button.view";

const TAG = "catalog-export-button";

function mount() {
	if (!customElements.get(TAG)) {
		createExportButtonCore()(TAG, exportButtonView);
	}
	const element = document.createElement(TAG) as HTMLElement & {
		export: () => void;
		fail: (reason: string | null) => void;
	};
	element.setAttribute("label", "Export JSON");
	document.body.appendChild(element);
	element.export();
	element.fail("Could not write the file.");
	const root = element.shadowRoot as unknown as HTMLElement;
	return { element, root, view: within(root) };
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("ExportButton accessibility", () => {
	it("puts the failure in text and marks the button busy only while preparing", () => {
		const { element, view } = mount();
		const reason = view.getByText("Could not write the file.");
		expect(reason.getAttribute("aria-hidden")).not.toBe("true");
		const retry = view.getByRole("button", { name: "Try again" });
		expect(retry.getAttribute("aria-disabled")).toBe("false");
		retry.click();
		expect(
			view
				.getByRole("button", { name: "Preparing…" })
				.getAttribute("aria-disabled"),
		).toBe("true");
		expect(
			element.shadowRoot?.querySelector("[aria-hidden='true']"),
		).toBeNull();
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
