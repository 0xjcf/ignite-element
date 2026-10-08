// @vitest-environment jsdom

import { within } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { createActionButtonCore } from "./action-button.core";
import { actionButtonGallery } from "./action-button.gallery";
import { actionButtonView } from "./action-button.view";

const TAG = "action-button";

function register() {
	if (customElements.get(TAG)) return;
	createActionButtonCore()(TAG, actionButtonView);
}

function mount(label: string, pendingLabel: string) {
	register();
	const element = document.createElement(TAG) as HTMLElement & {
		setPendingLabel: (value: string | null) => void;
		settle: () => void;
		allow: () => void;
		refuse: (reason: string | null) => void;
	};
	element.setAttribute("label", label);
	document.body.appendChild(element);
	element.setPendingLabel(pendingLabel);
	const root = element.shadowRoot as unknown as HTMLElement;
	return { element, root, view: within(root) };
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("ActionButton DOM", () => {
	it("shows each gallery label", async () => {
		register();
		for (const fixture of actionButtonGallery) {
			document.body.innerHTML = "";
			const { element, view } = mount(
				fixture.input.label,
				fixture.input.pendingLabel,
			);
			if (fixture.input.phase === "pending") {
				view.getByRole("button").click();
				expect(
					view.getByRole("button", { name: fixture.input.pendingLabel }),
				).toBeTruthy();
			} else if (fixture.input.phase === "unavailable") {
				element.refuse(fixture.input.reason);
				expect(
					view.getByRole("button", { name: fixture.input.label }),
				).toBeTruthy();
				expect(view.getByText(fixture.input.reason ?? "")).toBeTruthy();
			} else {
				expect(
					view.getByRole("button", { name: fixture.input.label }),
				).toBeTruthy();
			}
		}
	});

	it("does not let a refused click reach the host, and emits press when it can", async () => {
		const { element, view } = mount("Save", "Saving…");
		const hostClicks: string[] = [];
		const presses: string[] = [];
		element.addEventListener("click", () => {
			hostClicks.push("click");
		});
		element.addEventListener("press", (event) => {
			presses.push((event as CustomEvent<{ label: string }>).detail.label);
		});
		element.refuse("The guard is off.");
		view.getByRole("button", { name: "Save" }).click();
		expect(hostClicks).toEqual([]);
		expect(presses).toEqual([]);
		element.allow();
		view.getByRole("button", { name: "Save" }).click();
		expect(hostClicks).toEqual(["click"]);
		expect(presses).toEqual(["Save"]);
	});

	it("restores Action when the label attribute is removed", async () => {
		const { element, view } = mount("Save", "Saving…");
		expect(view.getByRole("button", { name: "Save" })).toBeTruthy();
		element.removeAttribute("label");
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(view.getByRole("button", { name: "Action" })).toBeTruthy();
	});

	it("reads a lowercased pendinglabel attribute after connect", async () => {
		const { element, view } = mount("Save", "Saving…");
		element.setAttribute("pendinglabel", "Writing…");
		await new Promise((resolve) => setTimeout(resolve, 0));
		view.getByRole("button", { name: "Save" }).click();
		expect(view.getByRole("button", { name: "Writing…" })).toBeTruthy();
	});

	it("shows the pending label after a click and keeps the idle label after settle", () => {
		const { element, view } = mount("Save Pay rent", "Saving…");
		view.getByRole("button", { name: "Save Pay rent" }).click();
		expect(view.getByRole("button", { name: "Saving…" })).toBeTruthy();
		element.settle();
		expect(view.getByRole("button", { name: "Save Pay rent" })).toBeTruthy();
	});
});
