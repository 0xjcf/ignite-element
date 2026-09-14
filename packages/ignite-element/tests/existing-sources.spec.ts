import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import type * as Scenario from "./shared-session-browser";

test("one borrowed counter feeds two actual JSX custom elements", async ({
	page,
}) => {
	await page.goto("/shared-counter.html");
	await expect(page.locator("shared-counter-summary")).toContainText(
		"Count: 0",
	);
	await page.getByRole("button", { name: "Count: 0" }).click();
	await expect(page.locator("shared-counter-summary")).toContainText(
		"Count: 1",
	);
});
test("one core keeps source-owned accounts separate and terminal disposal ends registered views", async ({
	page,
}) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	const blank = fileURLToPath(new URL("./source-free.html", import.meta.url));
	const scenario =
		"/@fs" +
		fileURLToPath(new URL("./shared-session-browser.ts", import.meta.url));
	await page.goto("/@fs" + blank);
	const result = await page.evaluate(async (url) => {
		const module: typeof Scenario = await import(url);
		return module.exerciseSessions();
	}, scenario);
	expect(result).toEqual({
		unknownWhileDetached: true,
		lateConfirmation: true,
		signedOut: true,
		bIsolated: true,
		freshA: true,
		cleared: true,
		inertConnection: true,
		staleRejected: true,
		borrowedAlive: true,
		definitionsPreserved: true,
	});
	expect(errors).toEqual([]);
});
