// @vitest-environment jsdom

import { within } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { createExportButtonCore } from "./export-button.core";
import { exportButtonGallery } from "./export-button.gallery";
import { exportButtonView } from "./export-button.view";

const TAG = "catalog-export-button";

function register() {
	if (customElements.get(TAG)) return;
	createExportButtonCore()(TAG, exportButtonView);
}

function mount(label: string) {
	register();
	const element = document.createElement(TAG) as HTMLElement & {
		export: () => void;
		succeed: () => void;
		fail: (reason: string | null) => void;
		reset: () => void;
	};
	element.setAttribute("label", label);
	document.body.appendChild(element);
	const root = element.shadowRoot as unknown as HTMLElement;
	return { element, root, view: within(root) };
}

function showPhase(
	element: {
		export: () => void;
		succeed: () => void;
		fail: (reason: string | null) => void;
	},
	phase: string,
	reason: string | null,
) {
	if (phase === "preparing" || phase === "ready" || phase === "failed") {
		element.export();
	}
	if (phase === "ready") element.succeed();
	if (phase === "failed") element.fail(reason);
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("ExportButton DOM", () => {
	it("shows each gallery label and failure reason", () => {
		for (const fixture of exportButtonGallery) {
			document.body.innerHTML = "";
			const { element, view } = mount(fixture.input.label);
			element.setAttribute("readylabel", fixture.input.readyLabel);
			showPhase(element, fixture.input.phase, fixture.input.reason);
			const name =
				fixture.input.phase === "preparing"
					? fixture.input.pendingLabel
					: fixture.input.phase === "ready"
						? fixture.input.readyLabel
						: fixture.input.phase === "failed"
							? "Try again"
							: fixture.input.label;
			expect(view.getByRole("button", { name })).toBeTruthy();
			if (fixture.input.reason) {
				expect(view.getAllByText(fixture.input.reason).length).toBeGreaterThan(
					0,
				);
			}
		}
	});

	it("emits export and does not let a preparing click reach the host", async () => {
		const { element, view } = mount("Export JSON");
		const formats: string[] = [];
		const hostClicks: number[] = [];
		element.addEventListener("export", (event) => {
			formats.push((event as CustomEvent<{ format: string }>).detail.format);
		});
		element.addEventListener("click", () => {
			hostClicks.push(1);
		});
		view.getByRole("button", { name: "Export JSON" }).click();
		expect(formats).toEqual(["json"]);
		expect(hostClicks).toEqual([1]);
		view.getByRole("button", { name: "Preparing…" }).click();
		expect(formats).toEqual(["json"]);
		expect(hostClicks).toEqual([1]);
		element.succeed();
		expect(view.getByRole("button", { name: "Exported" })).toBeTruthy();
	});

	it("reads a lowercased readylabel attribute after connect", async () => {
		const { element, view } = mount("Export JSON");
		element.setAttribute("readylabel", "File ready");
		await new Promise((resolve) => setTimeout(resolve, 0));
		element.export();
		element.succeed();
		expect(view.getByRole("button", { name: "File ready" })).toBeTruthy();
	});
});
