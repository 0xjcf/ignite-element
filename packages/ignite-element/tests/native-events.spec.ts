import { expect, test } from "@playwright/test";

test("two actual JSX hosts preserve native occurrences and per-view changes", async ({
	page,
}) => {
	await page.goto("/event-counter.html");
	const first = page.locator("app-counter").first();
	await expect(first).toContainText("Count: 0");
	await first.getByRole("button", { name: "Increment", exact: true }).click();
	await expect(page.locator("app-counter").nth(1)).toContainText("Count: 1");
	await first.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(first).toContainText("Count: 0");
	await first.getByRole("button", { name: "Reset", exact: true }).click();
	await expect
		.poll(async () => {
			const events: { type: string; detail: { count: number } }[] = JSON.parse(
				await page.locator("#notifications").innerText(),
			);
			return {
				changes: events
					.filter((e) => e.type === "countChanged")
					.map((e) => e.detail.count),
				resets: events
					.filter((e) => e.type === "counterReset")
					.map((e) => e.detail.count),
			};
		})
		.toEqual({ changes: [1, 1, 0, 0], resets: [0, 0, 0, 0] });
});
