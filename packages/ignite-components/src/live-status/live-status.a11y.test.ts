// @vitest-environment jsdom

import { within } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { catalogColors } from "../styles";
import { contrastRatio } from "../testing/contrast";
import { createLiveStatusCore } from "./live-status.core";
import { liveStatusView } from "./live-status.view";

const TAG = "live-status";

function mount() {
	if (!customElements.get(TAG)) {
		createLiveStatusCore()(TAG, liveStatusView);
	}
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
	return { element, root, view: within(root) };
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("LiveStatus accessibility", () => {
	it("keeps polite and assertive regions and puts busy only on the progress region", () => {
		const { root } = mount();
		const polite = root.querySelector("[aria-live='polite']");
		const assertive = root.querySelector("[aria-live='assertive']");
		expect(polite?.tagName).toBe("OUTPUT");
		expect(assertive?.getAttribute("role")).toBe("alert");
		expect(root.querySelector("[aria-busy='true']")).toBeNull();
		expect(root.querySelector("button")).toBeNull();
	});

	it("announces a change in the polite region and a failure in the alert", () => {
		const first = mount();
		first.element.setTone("warning");
		first.element.setPoliteness("polite");
		first.element.setMessage("Connecting");
		const polite = first.root.querySelector("[aria-live='polite']");
		expect(polite?.textContent).toContain("Connecting");
		expect(first.root.querySelector("[aria-busy='true']")).toBeNull();

		const second = mount();
		second.element.setTone("error");
		second.element.setPoliteness("assertive");
		second.element.setMessage("Could not save.");
		expect(
			second.root.querySelector("[aria-live='assertive']")?.textContent,
		).toContain("Could not save.");
		expect(first.root.querySelector("[aria-live='polite']")?.id).not.toBe(
			second.root.querySelector("[aria-live='polite']")?.id,
		);
	});

	it("marks only the busy region and shows indeterminate progress as text", () => {
		const { element, root, view } = mount();
		element.setProgress("indeterminate");
		element.setBusy("true");
		const busy = root.querySelector("[aria-busy='true']");
		expect(busy?.getAttribute("role")).toBe("progressbar");
		expect(busy?.tagName).not.toBe("BUTTON");
		expect(view.getByText("In progress")).toBeTruthy();
		expect(busy?.getAttribute("aria-valuenow")).toBeNull();
	});

	it("hides the skeleton from the accessible name and shows the settled line", () => {
		const { element, root, view } = mount();
		element.setProgress("skeleton");
		element.setBusy("true");
		expect(
			root.querySelector(".live-skeleton")?.getAttribute("aria-hidden"),
		).toBe("true");
		element.setBusy("false");
		element.setSettled("Exported");
		expect(view.getByText("Exported")).toBeTruthy();
		expect(root.querySelector("[aria-busy='true']")).toBeNull();
	});

	it("keeps announcer ink at WCAG AA", () => {
		expect(
			contrastRatio(catalogColors.fg, catalogColors.surface),
		).toBeGreaterThanOrEqual(4.5);
		expect(
			contrastRatio(catalogColors.fg, catalogColors.bg),
		).toBeGreaterThanOrEqual(4.5);
	});
});
