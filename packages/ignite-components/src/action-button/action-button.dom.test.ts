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

	it("shows the pending label after a click and keeps the idle label after settle", () => {
		const { element, view } = mount("Save Pay rent", "Saving…");
		view.getByRole("button", { name: "Save Pay rent" }).click();
		expect(view.getByRole("button", { name: "Saving…" })).toBeTruthy();
		element.settle();
		expect(view.getByRole("button", { name: "Save Pay rent" })).toBeTruthy();
	});
});
