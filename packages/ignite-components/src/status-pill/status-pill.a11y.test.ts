// @vitest-environment jsdom

import { within } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { catalogColors } from "../styles";
import { contrastRatio } from "../testing/contrast";
import { createStatusPillCore } from "./status-pill.core";
import { statusPillView } from "./status-pill.view";

const TAG = "status-pill";

function mount(value: string, tone: string, reason: string | null) {
	if (!customElements.get(TAG)) {
		createStatusPillCore()(TAG, statusPillView);
	}
	const element = document.createElement(TAG);
	element.setAttribute("value", value);
	element.setAttribute("tone", tone);
	if (reason) element.setAttribute("reason", reason);
	document.body.appendChild(element);
	const root = element.shadowRoot as unknown as HTMLElement;
	return { element, root, view: within(root) };
}

afterEach(() => {
	document.body.innerHTML = "";
});

function hiddenFromAssistiveTech(node: Node): boolean {
	let current: Node | null = node;
	while (current) {
		if (current instanceof Element) {
			const tag = current.tagName;
			if (tag === "STYLE" || tag === "SCRIPT") return true;
			if (current.getAttribute("aria-hidden") === "true") return true;
		}
		current = current.parentNode;
	}
	return false;
}

/** How many times the sentence is readable, counting the chip and the live region. */
function accessibleSentenceCount(root: ParentNode, sentence: string): number {
	const parts: string[] = [];
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	let node = walker.nextNode();
	while (node) {
		if (!hiddenFromAssistiveTech(node)) parts.push(node.textContent ?? "");
		node = walker.nextNode();
	}
	const text = parts.join("").replace(/\s+/g, " ");
	let count = 0;
	let from = 0;
	while (from <= text.length) {
		const at = text.indexOf(sentence, from);
		if (at === -1) break;
		count += 1;
		from = at + sentence.length;
	}
	return count;
}

describe("StatusPill accessibility", () => {
	it("puts the status in text, not in the tone alone", () => {
		const { root, view } = mount("Paused", "warning", "Inspection is paused.");
		const value = view.getByText("Paused");
		const reason = view.getByText("Inspection is paused.");
		expect(value.getAttribute("aria-hidden")).not.toBe("true");
		expect(reason.getAttribute("aria-hidden")).not.toBe("true");
		expect(value.closest("[aria-hidden='true']")).toBeNull();
		expect(reason.closest("[aria-hidden='true']")).toBeNull();
		const chip = value.closest(".status-pill");
		expect(chip?.getAttribute("data-tone")).toBe("warning");
		expect(view.getByText("Warning")).toBeTruthy();
		expect(chip?.textContent?.replace(/\s+/g, " ").trim()).toBe(
			"Warning Paused — Inspection is paused.",
		);
		expect(root.querySelector("[aria-live]")).toBeNull();
		expect(root.querySelector("style")?.textContent).toContain(
			"var(--status-pill-tone",
		);
		expect(root.querySelector("[tabindex]")).toBeNull();
		expect(root.querySelector("button")).toBeNull();
	});

	it("exposes the announced sentence once, on the polite region", () => {
		const { element, root } = mount(
			"Paused",
			"danger",
			"Inspection is paused.",
		);
		const host = element as HTMLElement & {
			setAnnounce: (announce: string | null) => void;
			setValue: (value: string | null) => void;
		};
		const sentence = "Danger Live — Inspection is paused.";
		host.setAnnounce("true");
		host.setValue("Live");
		expect(accessibleSentenceCount(root, sentence)).toBe(1);
		const polite = root.querySelector(".live-polite");
		expect(polite?.textContent).toBe(sentence);
		expect(polite?.getAttribute("aria-hidden")).not.toBe("true");
		expect(polite?.closest("[aria-hidden='true']")).toBeNull();
		expect(root.querySelector(".status-pill")?.textContent).toContain("Danger");
		expect(root.querySelector(".status-pill")?.textContent).toContain("Live");
	});

	it("announces a value change only when that pill opted in", () => {
		const { element, root } = mount(
			"Paused",
			"warning",
			"Inspection is paused.",
		);
		const host = element as HTMLElement & {
			setAnnounce: (announce: string | null) => void;
			setValue: (value: string | null) => void;
		};
		host.setAnnounce("true");
		const polite = root.querySelector("[aria-live='polite']");
		expect(polite?.textContent).toBe("");
		host.setValue("Live");
		expect(root.querySelector("[aria-live='polite']")).toBe(polite);
		expect(polite?.textContent).toContain("Live");
		expect(polite?.textContent).toContain("Warning");
		expect(polite?.classList.contains("live-polite")).toBe(true);
		expect(root.querySelector(".status-pill-value")?.textContent).toBe("Live");
		expect(root.querySelectorAll(".status-pill")).toHaveLength(1);
		const other = document.createElement(TAG);
		other.setAttribute("value", "Saved");
		other.setAttribute("tone", "success");
		document.body.appendChild(other);
		expect(other.shadowRoot?.querySelector("[aria-live]")).toBeNull();
		expect(root.querySelector("[aria-live='polite']")?.id).not.toBe(
			other.shadowRoot?.querySelector("[aria-live='polite']")?.id,
		);
	});

	it("keeps ink on each fill at WCAG AA", () => {
		const fills = [
			catalogColors.surface,
			catalogColors.bg,
			"#e7f0fa",
			"#e5f4ec",
			"#fbf0e2",
			"#f8e8e8",
		];
		for (const fill of fills) {
			expect(contrastRatio(catalogColors.fg, fill)).toBeGreaterThanOrEqual(4.5);
			expect(contrastRatio(catalogColors.muted, fill)).toBeGreaterThanOrEqual(
				4.5,
			);
		}
	});
});
