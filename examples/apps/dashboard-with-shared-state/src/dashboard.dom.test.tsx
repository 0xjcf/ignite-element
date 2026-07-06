// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import "./dashboard";

const flushMicrotasks = () =>
	new Promise<void>((resolve) => queueMicrotask(resolve));

describe("dashboard shared state — DOM accessibility", () => {
	it("labels each alert dismissal control with the alert title", async () => {
		await customElements.whenDefined("alert-feed");

		const element = document.createElement("alert-feed");
		document.body.appendChild(element);
		await flushMicrotasks();

		const root = element.shadowRoot ?? element;
		const labels = Array.from(root.querySelectorAll("button")).map((button) =>
			button.getAttribute("aria-label"),
		);

		expect(labels).toEqual([
			"Dismiss API latency above target for enterprise accounts",
			"Dismiss Renewal risk needs success follow-up",
			"Dismiss Ticket queue is trending above weekly baseline",
		]);

		element.remove();
	});
});
