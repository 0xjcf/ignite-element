import { expect, test } from "@playwright/test";

type AgentRuntimeView = {
	count: number;
	limit: number;
	step: number;
	isLimited: boolean;
	stateLabel: string;
};

type RuntimeEvent = {
	type: string;
	[key: string]: unknown;
};

type StoryTraceEntry = {
	kind: "command" | "event" | "snapshot" | "view";
};

type StoryLifecycleEntry = {
	stage:
		| "cleaned-up"
		| "connected"
		| "disconnected"
		| "registered"
		| "rendered";
};

type RuntimeStory = {
	execute: AgentRuntime["execute"];
	until: (
		predicate: (view: AgentRuntimeView) => boolean,
		action: () => Promise<void>,
		options?: { maxSteps?: number },
	) => Promise<AgentRuntimeView>;
	trace: () => StoryTraceEntry[];
	lifecycle: () => StoryLifecycleEntry[];
	summary: () => {
		commandCount: number;
		traceCount: number;
		lifecycleCount: number;
		events: RuntimeEvent[];
		finalView: AgentRuntimeView;
	};
	stop: () => void;
};

type AgentRuntime = {
	execute: (
		call:
			| { command: "increment" }
			| { command: "setLimit"; input: number }
			| { command: "setStep"; input: number },
	) => Promise<{
		events: RuntimeEvent[];
	}>;
	getSchema: () => {
		commands: Record<string, unknown>;
		events: { type: string }[];
		snapshot: unknown;
		view: AgentRuntimeView;
	};
	getView: () => AgentRuntimeView;
	record: (name: string) => RuntimeStory;
};

declare global {
	interface Window {
		__igniteExamples?: {
			apiShowcase?: AgentRuntime;
		};
	}
}

test("agents can drive the XState example runtime without DOM locators", async ({
	page,
}) => {
	await page.goto("/");

	const result = await page.evaluate(async () => {
		const runtime = window.__igniteExamples?.apiShowcase;
		if (!runtime) {
			throw new Error("window.__igniteExamples.apiShowcase is not available.");
		}

		const schema = runtime.getSchema();
		const startView = runtime.getView();
		const story = runtime.record("playwright reaches limit");

		await story.execute({ command: "setStep", input: 2 });
		const stepView = runtime.getView();
		await story.execute({ command: "setLimit", input: 6 });
		const limitView = runtime.getView();

		let steps = 0;
		const finalView = await story.until(
			(view) => view.isLimited,
			async () => {
				await story.execute({ command: "increment" });
				steps += 1;
			},
			{ maxSteps: 20 },
		);

		const probe = document.createElement("xstate-api-showcase");
		probe.setAttribute("hidden", "");
		document.body.appendChild(probe);
		probe.remove();
		await new Promise<void>((resolve) => queueMicrotask(resolve));

		const trace = story.trace();
		const lifecycle = story.lifecycle();
		const summary = story.summary();
		story.stop();

		return {
			commands: schema.commands,
			events: summary.events,
			finalView,
			limitView,
			lifecycleCount: summary.lifecycleCount,
			lifecycleStages: lifecycle.map((entry) => entry.stage),
			schemaEvents: schema.events,
			schemaSnapshot: schema.snapshot,
			schemaView: schema.view,
			startView,
			stepView,
			summaryCommandCount: summary.commandCount,
			summaryFinalView: summary.finalView,
			traceCount: summary.traceCount,
			traceKinds: trace.map((entry) => entry.kind),
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
	expect(result.schemaView).toEqual(result.startView);
	expect(result.startView.isLimited).toBe(false);
	expect(result.stepView.step).toBe(2);
	expect(result.limitView.limit).toBe(6);
	expect(result.steps).toBeGreaterThan(0);
	expect(result.finalView.isLimited).toBe(true);
	expect(result.finalView.count).toBe(result.finalView.limit);
	expect(result.summaryFinalView).toMatchObject(result.finalView);
	expect(result.summaryCommandCount).toBe(result.steps + 2);
	expect(result.traceCount).toBeGreaterThan(result.summaryCommandCount);
	expect(result.traceKinds).toEqual(
		expect.arrayContaining(["command", "event", "snapshot", "view"]),
	);
	expect(result.lifecycleCount).toBeGreaterThan(0);
	expect(result.lifecycleStages).toEqual(
		expect.arrayContaining([
			"connected",
			"rendered",
			"disconnected",
			"cleaned-up",
		]),
	);
	expect(result.finalView.stateLabel).toBe("Limit reached");
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
