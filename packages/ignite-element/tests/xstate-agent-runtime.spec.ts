import { expect, test } from "@playwright/test";
import type { apiShowcase } from "../../../examples/adapters/xstate/xstateApiShowcaseRuntime";

type ApiShowcaseRuntime = typeof apiShowcase;

test("agents can drive the XState example runtime without DOM locators", async ({
	page,
}) => {
	await page.goto("/");

	const result = await page.evaluate(async () => {
		const runtime: ApiShowcaseRuntime | undefined =
			window.__igniteExamples?.apiShowcase;
		if (!runtime) {
			throw new Error("window.__igniteExamples.apiShowcase is not available.");
		}

		const schema = runtime.getSchema();
		const startStates = runtime.getStates();
		const events: Awaited<ReturnType<typeof runtime.execute>>["events"] = [];

		await runtime.execute({ command: "setStep", input: 2 });
		const stepStates = runtime.getStates();
		await runtime.execute({ command: "setLimit", input: 6 });
		const limitStates = runtime.getStates();

		let steps = 0;
		while (!runtime.getStates().isLimited && steps < 20) {
			const result = await runtime.execute({ command: "increment" });
			events.push(...result.events);
			steps += 1;
		}
		const finalStates = runtime.getStates();

		return {
			commands: schema.commands,
			events,
			finalStates,
			limitStates,
			schemaEvents: schema.events,
			schemaSnapshot: schema.snapshot,
			schemaStates: schema.states,
			startStates,
			stepStates,
			steps,
		};
	});

	expect(result.commands).toEqual(
		expect.objectContaining({
			decrement: expect.any(Object),
			increment: expect.any(Object),
			reset: expect.any(Object),
			setLimit: expect.any(Object),
			setStep: expect.any(Object),
		}),
	);
	expect(result.commands).toMatchObject({
		decrement: {
			description: "Decrease the count by one.",
		},
		increment: {
			description: "Add the current step to the count.",
		},
		reset: {
			description: "Reset the count to zero.",
		},
		setLimit: {
			description: "Set maximum count before the limited state is reached.",
			input: {
				type: "number",
				minimum: 3,
				maximum: 12,
			},
		},
		setStep: {
			description: "Set the amount added by the increment command.",
			input: {
				type: "number",
				minimum: 1,
				maximum: 4,
			},
		},
	});
	expect(result.schemaEvents).toEqual([
		{ type: "api-count-changed" },
		{ type: "api-limit-reached" },
		{ type: "api-reset" },
	]);
	expect(result.schemaSnapshot).toMatchObject({
		context: { count: 0 },
		value: "active",
	});
	expect(result.schemaStates).toEqual(result.startStates);
	expect(result.startStates.isLimited).toBe(false);
	expect(result.stepStates.step).toBe(2);
	expect(result.limitStates.limit).toBe(6);
	expect(result.steps).toBeGreaterThan(0);
	expect(result.finalStates.isLimited).toBe(true);
	expect(result.finalStates.count).toBe(result.finalStates.limit);
	expect(result.finalStates.stateLabel).toBe("Limit reached");
	expect(result.events.map((event) => event.type)).toContain(
		"api-limit-reached",
	);
	expect(result.events.map((event) => event.type)).toContain(
		"api-count-changed",
	);
	expect(result.events).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				type: "api-count-changed",
				count: expect.any(Number),
			}),
			expect.objectContaining({
				type: "api-limit-reached",
				count: 6,
				limit: 6,
			}),
		]),
	);
	expect(result.events.some((event) => "payload" in event)).toBe(false);
});

test("registered showcase buttons update the rendered count", async ({
	page,
}) => {
	await page.goto("/");
	const counter = page.locator("xstate-api-showcase");
	await counter.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(
		counter.getByRole("heading", { name: /^Count 0 \/ / }),
	).toBeVisible();
	await counter
		.getByRole("button", { name: "Add ctx.step", exact: true })
		.click();
	await expect(
		counter.getByRole("heading", { name: /^Count 1 \/ / }),
	).toBeVisible();
});
