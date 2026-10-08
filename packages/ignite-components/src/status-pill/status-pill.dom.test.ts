// @vitest-environment jsdom

import { getByText, queryByText, within } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { createStatusPillCore } from "./status-pill.core";
import type { StatusPillFixtureInput } from "./status-pill.gallery";
import { statusPillGallery } from "./status-pill.gallery";
import { statusPillView } from "./status-pill.view";

const TAG = "status-pill";

function register() {
	if (customElements.get(TAG)) return;
	createStatusPillCore()(TAG, statusPillView);
}

function mount(input: StatusPillFixtureInput) {
	register();
	const element = document.createElement(TAG);
	element.setAttribute("value", input.value);
	element.setAttribute("tone", input.tone);
	if (input.reason) element.setAttribute("reason", input.reason);
	document.body.appendChild(element);
	const root = element.shadowRoot as unknown as HTMLElement;
	return { element, root, view: within(root) };
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("StatusPill DOM", () => {
	it("shows the words for every gallery fixture", () => {
		for (const fixture of statusPillGallery) {
			document.body.innerHTML = "";
			const { view } = mount(fixture.input);
			expect(view.getByText(fixture.input.value)).toBeTruthy();
			if (fixture.input.reason) {
				expect(view.getByText(fixture.input.reason)).toBeTruthy();
				expect(view.getByText("—")).toBeTruthy();
			}
		}
	});

	it("updates the label from the value attribute", async () => {
		const { element, root } = mount({
			value: "Saved",
			tone: "neutral",
			reason: null,
		});
		expect(getByText(root, "Saved")).toBeTruthy();
		element.setAttribute("value", "In Today");
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(getByText(root, "In Today")).toBeTruthy();
		expect(queryByText(root, "Saved")).toBeNull();
	});

	it("does not register a tag by importing the view", () => {
		expect(statusPillView).toBeTypeOf("function");
		expect(customElements.get("statuspill")).toBeUndefined();
	});
});
