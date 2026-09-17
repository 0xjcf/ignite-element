import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import type * as Scenario from "../src/tests/fixtures/factoryEntrypoints";

for (const kind of ["mobx", "redux"] as const) {
	for (const shared of [false, true]) {
		test(`${kind} ${shared ? "shared" : "factory"} lifecycle through public imports`, async ({
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
					new URL(
						"../src/tests/fixtures/factoryEntrypoints.ts",
						import.meta.url,
					),
				);
			const result = await page.evaluate(
				async ({ url, kind, shared }) => {
					const scenario: typeof Scenario = await import(url);
					return scenario.exerciseFactoryLifetime(kind, shared);
				},
				{ url, kind, shared },
			);
			expect(result).toMatchObject({
				beforeRegistration: shared ? 1 : 0,
				beforeConnection: shared ? 1 : 0,
				afterCommand: shared ? ["1", "1"] : ["1", "0"],
				afterMove: {
					calls: shared ? 1 : 2,
					counts: shared ? ["1", "1"] : ["1", "0"],
				},
				afterReconnect: {
					calls: shared ? 1 : 3,
					counts: shared ? ["1", "1"] : ["0", "0"],
				},
				released: true,
				cleared: true,
				staleRejected: true,
				nativeStillUsable: true,
				afterDisposedConnection: { calls: shared ? 1 : 3, counts: ["", ""] },
			});
			expect(errors).toEqual([]);
		});
	}
}
