// @vitest-environment jsdom

import { within } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { createLiveStatusCore } from "./live-status.core";
import { liveStatusGallery } from "./live-status.gallery";
import { liveStatusView } from "./live-status.view";

const TAG = "live-status";

function register() {
	if (customElements.get(TAG)) return;
	createLiveStatusCore()(TAG, liveStatusView);
}

function mount() {
	register();
	const element = document.createElement(TAG) as HTMLElement & {
		setMessage: (message: string | null) => void;
		setPoliteness: (politeness: string | null) => void;
		setBusy: (busy: string | null) => void;
		setProgress: (progress: string | null) => void;
		setSettled: (settled: string | null) => void;
		setTone: (tone: string | null) => void;
	};
	document.body.appendChild(element);
	const root = element.shadowRoot as unknown as HTMLElement;
	return { element, view: within(root) };
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("LiveStatus DOM", () => {
	it("shows each gallery announcement", () => {
		for (const fixture of liveStatusGallery) {
			document.body.innerHTML = "";
			const { element, view } = mount();
			element.setTone(fixture.input.tone);
			element.setProgress(fixture.input.progress);
			if (fixture.input.settled) element.setSettled(fixture.input.settled);
			else if (fixture.input.message) {
				element.setPoliteness(fixture.input.politeness);
				element.setMessage(fixture.input.message);
			}
			if (fixture.input.busy) element.setBusy("true");
			if (fixture.input.settled) {
				expect(view.getByText(fixture.input.settled)).toBeTruthy();
			}
			if (fixture.input.busy) {
				const label =
					fixture.input.message.length > 0 &&
					fixture.input.message !== "in progress"
						? fixture.input.message
						: "In progress";
				expect(view.getAllByText(label).length).toBeGreaterThan(0);
			}
			if (
				!fixture.input.busy &&
				!fixture.input.settled &&
				fixture.input.message
			) {
				expect(view.getAllByText(fixture.input.message).length).toBeGreaterThan(
					0,
				);
			}
		}
	});
});
