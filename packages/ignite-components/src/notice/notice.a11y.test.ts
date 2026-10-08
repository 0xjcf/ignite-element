// @vitest-environment jsdom

import { within } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { catalogColors } from "../styles";
import { contrastRatio } from "../testing/contrast";
import { createNoticeCore } from "./notice.core";
import { noticeView } from "./notice.view";

const TAG = "catalog-notice";

function mount() {
	if (!customElements.get(TAG)) {
		createNoticeCore()(TAG, noticeView);
	}
	const element = document.createElement(TAG) as HTMLElement & {
		setTone: (tone: string | null) => void;
		setActions: (actions: string | null) => void;
		setDismissible: (value: string | null) => void;
		setFocustarget: (target: string | null) => void;
	};
	element.setAttribute("message", "Which Friday?");
	document.body.appendChild(element);
	element.setTone("warning");
	element.setActions("This Friday\nNext Friday");
	element.setDismissible("true");
	const root = element.shadowRoot as unknown as HTMLElement;
	return { element, view: within(root) };
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("Notice accessibility", () => {
	it("uses an alert for a warning and keeps actions focusable", () => {
		const { element, view } = mount();
		const alert = view.getByRole("alert");
		expect(alert.textContent).toContain("Warning");
		expect(alert.textContent).toContain("Which Friday?");
		const action = view.getByRole("button", { name: "This Friday" });
		const dismiss = view.getByRole("button", { name: "Dismiss" });
		expect(action.hasAttribute("disabled")).toBe(false);
		expect(dismiss.hasAttribute("disabled")).toBe(false);
		action.focus();
		expect(element.shadowRoot?.activeElement).toBe(action);
		dismiss.focus();
		expect(element.shadowRoot?.activeElement).toBe(dismiss);
	});

	it("does not move focus onto a different action when the list changes", () => {
		const { element, view } = mount();
		element.setActions("");
		const dismiss = view.getByRole("button", { name: "Dismiss" });
		dismiss.focus();
		expect(element.shadowRoot?.activeElement).toBe(dismiss);
		element.setActions("Retry");
		const retry = view.getByRole("button", { name: "Retry" });
		expect(element.shadowRoot?.activeElement).not.toBe(retry);
		retry.focus();
		element.setActions("Next Friday\nRetry");
		expect(element.shadowRoot?.activeElement).not.toBe(
			view.getByRole("button", { name: "Next Friday" }),
		);
	});

	it("emits recover for the action that was pressed", () => {
		const { element, view } = mount();
		const labels: string[] = [];
		element.addEventListener("recover", (event) => {
			labels.push((event as CustomEvent<{ label: string }>).detail.label);
		});
		view.getByRole("button", { name: "This Friday" }).click();
		expect(labels).toEqual(["This Friday"]);
	});

	it("moves focus once and does not collide with a second notice", () => {
		const { element, view } = mount();
		const next = document.createElement("button");
		next.id = "after-notice";
		next.textContent = "Continue";
		document.body.appendChild(next);
		element.setFocustarget("after-notice");
		const first: Array<{ label: string; instanceId: string }> = [];
		element.addEventListener("recover", (event) => {
			first.push(
				(event as CustomEvent<{ label: string; instanceId: string }>).detail,
			);
		});
		const action = view.getByRole("button", { name: "This Friday" });
		action.click();
		action.click();
		expect(first).toHaveLength(1);
		expect(first[0]?.label).toBe("This Friday");
		expect(first[0]?.instanceId).toMatch(/^notice-/);
		expect(document.activeElement).toBe(next);

		const other = document.createElement(TAG) as HTMLElement & {
			setTone: (tone: string | null) => void;
			setActions: (actions: string | null) => void;
		};
		other.setAttribute("message", "Reconnect to the page.");
		document.body.appendChild(other);
		other.setTone("warning");
		other.setActions("Reconnect");
		const otherView = within(other.shadowRoot as unknown as HTMLElement);
		const otherMessage = otherView.getByText("Reconnect to the page.");
		expect(otherMessage.id).not.toBe(view.getByText("Which Friday?").id);
		const second: string[] = [];
		other.addEventListener("recover", (event) => {
			second.push((event as CustomEvent<{ label: string }>).detail.label);
		});
		otherView.getByRole("button", { name: "Reconnect" }).click();
		expect(second).toEqual(["Reconnect"]);
		expect(first).toHaveLength(1);
	});

	it("moves focus to the host when dismiss has no external target", () => {
		const { element, view } = mount();
		view.getByRole("button", { name: "Dismiss" }).click();
		expect(document.activeElement).toBe(element);
		expect(element.tabIndex).toBe(-1);
		expect(view.getByRole("alert", { hidden: true }).hidden).toBe(true);
	});

	it("keeps tone fills at WCAG AA against the ink", () => {
		for (const fill of [
			catalogColors.surface,
			catalogColors.infoFill,
			catalogColors.warningFill,
			catalogColors.dangerFill,
		]) {
			expect(contrastRatio(catalogColors.fg, fill)).toBeGreaterThanOrEqual(4.5);
		}
	});
});
