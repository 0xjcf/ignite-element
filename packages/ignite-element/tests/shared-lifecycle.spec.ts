import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import type * as Scenario from "./shared-lifecycle-browser";

for (const kind of ["xstate", "redux", "mobx", "actor-web"]) {
	for (const withEffects of [false, true]) {
		test(`${kind} reconnect retains current state and event delivery (effects=${withEffects})`, async ({
			page,
		}) => {
			const errors: string[] = [];
			page.on("pageerror", (error) => errors.push(error.message));
			await page.goto(
				"/@fs" + fileURLToPath(new URL("./source-free.html", import.meta.url)),
			);
			const url =
				"/@fs" +
				fileURLToPath(
					new URL("./shared-lifecycle-browser.ts", import.meta.url),
				);
			const result = await page.evaluate(
				async ({ url, kind, withEffects }) => {
					const scenario: typeof Scenario = await import(url);
					return scenario.sharedLifecycle(kind, withEffects);
				},
				{ url, kind, withEffects },
			);
			expect(result).toEqual({
				shared: "1",
				moved: "1",
				reconnected: "2",
				commanded: "3",
				cleared: "",
				events: withEffects ? [1, 3] : [],
				evaluations: withEffects ? [1, 2, 3] : [],
				borrowedStatus: "active",
			});
			expect(errors).toEqual([]);
		});
	}
}
