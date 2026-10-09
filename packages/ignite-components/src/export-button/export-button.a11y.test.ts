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
	it("puts the failure in text and marks the progressbar busy while preparing", () => {
		const { element, root, view } = mount();
		expect(view.getAllByText("error: Could not write the file.")).toHaveLength(
			1,
		);
		const failure = root.querySelector("[aria-live='assertive']");
		expect(failure?.textContent).toContain("error: Could not write the file.");
		expect(root.querySelector("p.reason")).toBeNull();
		const retry = view.getByRole("button", { name: "Try again" });
		expect(retry.getAttribute("aria-disabled")).toBe("false");
		expect(retry.getAttribute("aria-describedby")).toBe(failure?.id);
		retry.click();
		const preparing = view.getByRole("button", { name: "Export JSON" });
		expect(preparing.getAttribute("aria-disabled")).toBe("true");
		expect(preparing.hasAttribute("aria-busy")).toBe(false);
		expect(preparing.hasAttribute("aria-describedby")).toBe(false);
		expect(view.getAllByText("Preparing…")).toHaveLength(1);
		expect(root.querySelector("[aria-live='polite']")?.textContent).toContain(
			"Preparing…",
		);
		expect(view.queryByText("already running")).toBeNull();
		const busy = element.shadowRoot?.querySelector("[aria-busy='true']");
		expect(busy?.getAttribute("role")).toBe("progressbar");
		expect(busy?.tagName).not.toBe("BUTTON");
		expect(busy?.textContent?.trim() ?? "").toBe("");
		expect(
			element.shadowRoot?.querySelector("[aria-hidden='true']"),
		).toBeNull();
	});

	it("follows setFormat and announces ready and failed", () => {
		const { element, view } = mount();
		const host = element as unknown as HTMLElement & {
			setFormat: (format: string | null) => void;
			succeed: () => void;
			reset: () => void;
		};
		host.reset();
		host.setFormat("csv");
		expect(view.getByRole("button", { name: "Export CSV" })).toBeTruthy();
		const polite = element.shadowRoot?.querySelector("[aria-live='polite']");
		expect(polite?.textContent?.trim() ?? "").toBe("");
		view.getByRole("button", { name: "Export CSV" }).click();
		expect(view.getByRole("progressbar").getAttribute("aria-busy")).toBe(
			"true",
		);
		expect(view.getAllByText("Preparing…")).toHaveLength(1);
		expect(polite?.textContent).toContain("Preparing…");
		host.succeed();
		expect(view.getAllByText("Exported")).toHaveLength(1);
		expect(polite?.textContent).toContain("Exported");
		expect(view.getByRole("button", { name: "Export CSV" })).toBeTruthy();
		expect(element.shadowRoot?.querySelector("[aria-busy='true']")).toBeNull();
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
