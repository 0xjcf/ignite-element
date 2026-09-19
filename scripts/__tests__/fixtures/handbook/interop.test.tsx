import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { expect, it } from "vitest";
import { WebInterop } from "./src/WebInterop";

it("updates React from the element's emitted count and starts fresh on remount", async () => {
	try {
		const view = render(<WebInterop />);
		expect(
			screen.getByRole("status", { name: "React event status" }).textContent,
		).toBe("Waiting for an event.");
		const host = view.container.querySelector("react-demo-counter");
		const increment = host?.shadowRoot?.querySelector(
			'[aria-label="Increment"]',
		);
		const decrement = host?.shadowRoot?.querySelector(
			'[aria-label="Decrement"]',
		);
		if (!increment || !decrement || !host)
			throw new Error("Counter controls missing");
		const events: number[] = [];
		host.addEventListener("countChanged", (event) => {
			if (event instanceof CustomEvent) events.push(event.detail.count);
		});

		fireEvent.click(increment);
		await waitFor(() =>
			expect(
				screen.getByRole("status", { name: "React event status" }).textContent,
			).toBe("React received: 1 — Odd"),
		);
		expect(
			screen
				.getByRole("status", { name: "React event status" })
				.getAttribute("data-parity"),
		).toBe("odd");
		fireEvent.click(increment);
		await waitFor(() =>
			expect(
				screen.getByRole("status", { name: "React event status" }).textContent,
			).toBe("React received: 2 — Even"),
		);
		expect(
			screen
				.getByRole("status", { name: "React event status" })
				.getAttribute("data-parity"),
		).toBe("even");
		fireEvent.click(decrement);
		await waitFor(() =>
			expect(
				screen.getByRole("status", { name: "React event status" }).textContent,
			).toBe("React received: 1 — Odd"),
		);
		expect(events).toEqual([1, 2, 1]);
		view.unmount();
		render(<WebInterop />);
		fireEvent(host, new CustomEvent("countChanged", { detail: { count: 99 } }));
		expect(
			screen.getByRole("status", { name: "React event status" }).textContent,
		).toBe("Waiting for an event.");
	} finally {
		cleanup();
	}
});
