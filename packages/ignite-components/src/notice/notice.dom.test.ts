// @vitest-environment jsdom

import { within } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { createNoticeCore } from "./notice.core";
import { noticeGallery } from "./notice.gallery";
import { toneWord } from "./notice.source";
import { noticeView } from "./notice.view";

const TAG = "catalog-notice";

function register() {
	if (customElements.get(TAG)) return;
	createNoticeCore()(TAG, noticeView);
}

function mount(message: string) {
	register();
	const element = document.createElement(TAG) as HTMLElement & {
		setTone: (tone: string | null) => void;
		setActions: (actions: string | null) => void;
		setDismissible: (value: string | null) => void;
		dismiss: () => void;
	};
	element.setAttribute("message", message);
	document.body.appendChild(element);
	const root = element.shadowRoot as unknown as HTMLElement;
	return { element, view: within(root) };
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("Notice DOM", () => {
	it("shows each gallery message, tone word, and recovery action", () => {
		for (const fixture of noticeGallery) {
			document.body.innerHTML = "";
			const { element, view } = mount(fixture.input.message);
			element.setTone(fixture.input.tone);
			element.setActions(fixture.input.actions.join("\n"));
			element.setDismissible(fixture.input.dismissible ? "true" : "false");
			if (fixture.input.dismissed) element.dismiss();
			const panel = element.shadowRoot?.querySelector("section");
			expect(panel?.hidden).toBe(fixture.input.dismissed);
			if (fixture.input.dismissed) continue;
			expect(view.getByText(toneWord(fixture.input.tone))).toBeTruthy();
			expect(view.getByText(fixture.input.message)).toBeTruthy();
			for (const label of fixture.input.actions) {
				expect(view.getByRole("button", { name: label })).toBeTruthy();
			}
			if (fixture.input.dismissible) {
				expect(view.getByRole("button", { name: "Dismiss" })).toBeTruthy();
			}
		}
	});
});
