import { igniteCore } from "ignite-element/xstate";
import { assign, fromPromise, setup } from "xstate";
// Tailwind classes need to reach this component's Shadow DOM; inject the built
// sheet as raw text (config-free). See xstateExample.tsx for the rationale.
import twStyles from "./dist/styles.css?raw";
import { apiShowcase } from "./xstateApiShowcaseRuntime";

type RuntimeCommand =
	| "inspect"
	| "increment"
	| "decrement"
	| "reset"
	| "incrementToLimit";
type PayloadCommand = "setStep" | "setLimit";
type ApiShowcaseState = ReturnType<typeof apiShowcase.getSnapshot>;
type ApiShowcaseStates = ReturnType<typeof apiShowcase.getStates>;
type ApiShowcaseStory = ReturnType<typeof apiShowcase.record>;
type RuntimeEventRecord = {
	type: string;
	[key: string]: unknown;
};
type RuntimeExecution = {
	resultEvents: RuntimeEventRecord[];
	agentLog: string[];
};
type RuntimeReportRequest = {
	command: RuntimeCommand | PayloadCommand;
	payload?: number;
};

interface RuntimeReport {
	command: string;
	code: string;
	schema: ReturnType<typeof apiShowcase.getSchema>;
	state: {
		value: string;
		count: number;
		limit: number;
		step: number;
		lastCommand: string;
	};
	states: ReturnType<typeof apiShowcase.getStates>;
	resultEvents: RuntimeEventRecord[];
	eventLog: string[];
	stateLog: string[];
	statesLog: string[];
	agentLog: string[];
	traceLog: string[];
	lifecycleLog: string[];
	storySummary: {
		commandCount: number;
		traceCount: number;
		lifecycleCount: number;
		eventCount: number;
		finalStates: ApiShowcaseStates;
	};
}

interface AgentRuntimeContext {
	report: RuntimeReport;
	step: number;
	limit: number;
	request: RuntimeReportRequest;
}

type AgentRuntimeEvent =
	| { type: "INSPECT" }
	| { type: "RUN"; command: RuntimeCommand }
	| { type: "SET_STEP_DRAFT"; step: number }
	| { type: "SET_LIMIT_DRAFT"; limit: number }
	| { type: "APPLY_STEP" }
	| { type: "APPLY_LIMIT" };

const formatPayload = (payload: unknown) => JSON.stringify(payload);
const formatEventFields = (event: RuntimeEventRecord) => {
	const fields: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(event)) {
		if (key !== "type") {
			fields[key] = value;
		}
	}
	return formatPayload(fields);
};

const summarizeState = (state: ApiShowcaseState): RuntimeReport["state"] => ({
	value: String(state.value),
	count: state.context.count,
	limit: state.context.limit,
	step: state.context.step,
	lastCommand: state.context.lastCommand,
});

const formatJson = (value: unknown) => JSON.stringify(value, null, 2);

const formatTraceEntry = (
	entry: ReturnType<ApiShowcaseStory["trace"]>[number],
) => {
	switch (entry.kind) {
		case "command":
			return `command #${entry.step}: ${entry.command}`;
		case "event":
			return `event #${entry.step}: ${entry.event}`;
		case "behavior":
			return `behavior #${entry.step}: ${entry.name}`;
		case "snapshot":
			return `snapshot ${entry.phase} #${entry.step}`;
		case "states":
			return `states ${entry.phase} #${entry.step}`;
	}
};

const formatLifecycleEntry = (
	entry: ReturnType<ApiShowcaseStory["lifecycle"]>[number],
) => {
	const instance =
		typeof entry.instanceId === "number" ? ` #${entry.instanceId}` : "";
	return `${entry.stage}: ${entry.elementName}${instance}`;
};

const collectLifecycleProbe = () => {
	if (
		typeof document === "undefined" ||
		!document.body ||
		!customElements.get("xstate-api-showcase")
	) {
		return;
	}

	const probe = document.createElement("xstate-api-showcase");
	probe.setAttribute("hidden", "");
	document.body.appendChild(probe);
	probe.remove();
};

const mapRuntimeEvents = (
	events: ReadonlyArray<RuntimeEventRecord>,
): RuntimeEventRecord[] =>
	events.map((event) => ({
		...event,
	}));

const codeForCommand = (
	command: RuntimeCommand | PayloadCommand,
	payload?: number,
) => {
	switch (command) {
		case "inspect":
			return [
				"apiShowcase.getSchema()",
				"apiShowcase.getSnapshot()",
				"apiShowcase.getStates()",
			].join("\n");
		case "setStep":
			return `await story.execute({ command: "setStep", input: ${payload ?? 1} })`;
		case "setLimit":
			return `await story.execute({ command: "setLimit", input: ${payload ?? 5} })`;
		case "incrementToLimit":
			return [
				'const story = apiShowcase.record("reaches limit")',
				"await story.until(",
				"  (states) => states.isLimited,",
				'  async () => await story.execute({ command: "increment" }),',
				"  { maxSteps: 20 },",
				")",
				"story.trace()",
				"story.lifecycle()",
				"story.summary()",
			].join("\n");
		default:
			return `await story.execute({ command: "${command}" })`;
	}
};

const createPlaceholderReport = (command: string): RuntimeReport => ({
	command,
	code: "// Loading runtime report...",
	schema: apiShowcase.getSchema(),
	state: summarizeState(apiShowcase.getSnapshot()),
	states: apiShowcase.getStates(),
	resultEvents: [],
	eventLog: [],
	stateLog: [],
	statesLog: [],
	agentLog: [],
	traceLog: [],
	lifecycleLog: [],
	storySummary: {
		commandCount: 0,
		traceCount: 0,
		lifecycleCount: 0,
		eventCount: 0,
		finalStates: apiShowcase.getStates(),
	},
});

const inspectRuntime = (): RuntimeExecution => {
	const schema = apiShowcase.getSchema();
	const state = summarizeState(apiShowcase.getSnapshot());
	const states = apiShowcase.getStates();
	const commandNames = Object.keys(schema.commands);
	const eventNames = schema.events.map((event) => event.type);

	return {
		resultEvents: [],
		agentLog: [
			`getSchema() -> ${commandNames.length} commands, ${schema.events.length} events`,
			`commands -> ${commandNames.join(", ") || "none"}`,
			`events -> ${eventNames.join(", ") || "none"}`,
			`getSnapshot() -> count ${state.count}/${state.limit}, state ${state.value}`,
			`getStates() -> ${states.stateLabel}, progress ${states.progress}%`,
		],
	};
};

const incrementToLimit = async (
	story: ApiShowcaseStory,
): Promise<RuntimeExecution> => {
	const schema = apiShowcase.getSchema();
	const commandNames = Object.keys(schema.commands);
	const agentLog = [`getSchema() commands -> ${commandNames.join(", ")}`];
	const resultEvents: RuntimeEventRecord[] = [];

	if (!("increment" in schema.commands)) {
		return {
			resultEvents,
			agentLog: [
				...agentLog,
				'Cannot continue: command "increment" is absent.',
			],
		};
	}

	let states: ApiShowcaseStates = apiShowcase.getStates();
	agentLog.push(
		`getStates() -> count ${states.count}/${states.limit}, limited ${states.isLimited}`,
	);

	const maxSteps = Math.max(1, states.limit - states.count + 1);
	let steps = 0;

	while (!states.isLimited && steps < maxSteps) {
		const result = await story.execute({ command: "increment" });
		resultEvents.push(...mapRuntimeEvents(result.events));
		states = apiShowcase.getStates();
		steps += 1;
		agentLog.push(
			`execute({ command: "increment" }) -> count ${states.count}/${states.limit}, state ${states.stateLabel}`,
		);
	}

	agentLog.push(
		states.isLimited
			? `Goal reached after ${steps} increment command(s).`
			: `Stopped after ${steps} command(s) before reaching the limit guard.`,
	);

	return {
		resultEvents,
		agentLog,
	};
};

const executeRuntimeCommand = async (
	story: ApiShowcaseStory,
	command: RuntimeCommand | PayloadCommand,
	payload?: number,
): Promise<RuntimeExecution> => {
	switch (command) {
		case "inspect":
			return inspectRuntime();
		case "increment":
			return {
				resultEvents: mapRuntimeEvents(
					(await story.execute({ command: "increment" })).events,
				),
				agentLog: ['execute({ command: "increment" })'],
			};
		case "decrement":
			return {
				resultEvents: mapRuntimeEvents(
					(await story.execute({ command: "decrement" })).events,
				),
				agentLog: ['execute({ command: "decrement" })'],
			};
		case "reset":
			return {
				resultEvents: mapRuntimeEvents(
					(await story.execute({ command: "reset" })).events,
				),
				agentLog: ['execute({ command: "reset" })'],
			};
		case "incrementToLimit":
			return incrementToLimit(story);
		case "setStep":
			return {
				resultEvents: mapRuntimeEvents(
					(await story.execute({ command: "setStep", input: payload ?? 1 }))
						.events,
				),
				agentLog: [`execute({ command: "setStep", input: ${payload ?? 1} })`],
			};
		case "setLimit":
			return {
				resultEvents: mapRuntimeEvents(
					(await story.execute({ command: "setLimit", input: payload ?? 5 }))
						.events,
				),
				agentLog: [`execute({ command: "setLimit", input: ${payload ?? 5} })`],
			};
	}
};

const createRuntimeReport = async (
	command: RuntimeCommand | PayloadCommand,
	payload?: number,
): Promise<RuntimeReport> => {
	const eventLog: string[] = [];
	const stateLog: string[] = [];
	const statesLog: string[] = [];
	const story = apiShowcase.record(
		typeof payload === "number" ? `${command}(${payload})` : `${command}()`,
	);

	const countSubscription = apiShowcase.on("api-count-changed", (event) => {
		eventLog.push(`on("api-count-changed") -> ${formatEventFields(event)}`);
	});
	const limitSubscription = apiShowcase.on("api-limit-reached", (event) => {
		eventLog.push(`on("api-limit-reached") -> ${formatEventFields(event)}`);
	});
	const resetSubscription = apiShowcase.on("api-reset", (event) => {
		eventLog.push(`on("api-reset") -> ${formatEventFields(event)}`);
	});
	const stateSubscription = apiShowcase.watchSnapshot((state, prevState) => {
		stateLog.push(
			`watchSnapshot(...) count ${prevState.context.count} -> ${state.context.count}`,
		);
	});
	const statesSubscription = apiShowcase.watchStates((states, prevStates) => {
		statesLog.push(
			`watchStates(...) ${prevStates.stateLabel} -> ${states.stateLabel}`,
		);
	});

	let resultEvents: RuntimeEventRecord[] = [];
	let agentLog: string[] = [];
	let traceLog: string[] = [];
	let lifecycleLog: string[] = [];
	let storySummary: RuntimeReport["storySummary"];

	try {
		const result = await executeRuntimeCommand(story, command, payload);
		resultEvents = result.resultEvents;
		agentLog = result.agentLog;
		collectLifecycleProbe();
	} finally {
		countSubscription.unsubscribe();
		limitSubscription.unsubscribe();
		resetSubscription.unsubscribe();
		stateSubscription.unsubscribe();
		statesSubscription.unsubscribe();
		traceLog = story.trace().map(formatTraceEntry);
		lifecycleLog = story.lifecycle().map(formatLifecycleEntry);
		const summary = story.summary();
		storySummary = {
			commandCount: summary.commandCount,
			traceCount: summary.traceCount,
			lifecycleCount: summary.lifecycleCount,
			eventCount: summary.events.length,
			finalStates: summary.finalStates,
		};
		story.stop();
	}

	return {
		command:
			typeof payload === "number" ? `${command}(${payload})` : `${command}()`,
		code: codeForCommand(command, payload),
		schema: apiShowcase.getSchema(),
		state: summarizeState(apiShowcase.getSnapshot()),
		states: apiShowcase.getStates(),
		resultEvents,
		eventLog,
		stateLog,
		statesLog,
		agentLog,
		traceLog,
		lifecycleLog,
		storySummary,
	};
};

const readNumber = (event: Event, fallback: number) => {
	const input = event.currentTarget as HTMLInputElement | null;
	const value = Number(input?.value);
	return Number.isFinite(value) ? value : fallback;
};

const agentRuntimeMachine = setup({
	types: {
		context: {} as AgentRuntimeContext,
		events: {} as AgentRuntimeEvent,
	},
	actors: {
		createRuntimeReport: fromPromise(
			async ({ input }: { input: RuntimeReportRequest }) =>
				createRuntimeReport(input.command, input.payload),
		),
	},
}).createMachine({
	id: "agentRuntimeShowcase",
	initial: "loading",
	context: {
		report: createPlaceholderReport("inspect()"),
		step: 2,
		limit: 8,
		request: { command: "inspect" },
	},
	states: {
		loading: {
			invoke: {
				src: "createRuntimeReport",
				input: ({ context }) => context.request,
				onDone: {
					target: "ready",
					actions: assign({
						report: ({ event }) => event.output,
					}),
				},
			},
		},
		ready: {
			on: {
				INSPECT: {
					target: "loading",
					actions: assign({
						request: () => ({ command: "inspect" }),
					}),
				},
				RUN: {
					target: "loading",
					actions: assign({
						request: ({ event }) => ({ command: event.command }),
					}),
				},
				SET_STEP_DRAFT: {
					actions: assign({
						step: ({ event }) => event.step,
					}),
				},
				SET_LIMIT_DRAFT: {
					actions: assign({
						limit: ({ event }) => event.limit,
					}),
				},
				APPLY_STEP: {
					target: "loading",
					actions: assign({
						request: ({ context }) => ({
							command: "setStep",
							payload: context.step,
						}),
					}),
				},
				APPLY_LIMIT: {
					target: "loading",
					actions: assign({
						request: ({ context }) => ({
							command: "setLimit",
							payload: context.limit,
						}),
					}),
				},
			},
		},
	},
});

const agentRuntimeShowcase = igniteCore({
	source: agentRuntimeMachine,
	states: (snapshot) => ({
		report: snapshot.context.report,
		step: snapshot.context.step,
		limit: snapshot.context.limit,
		eventCount: snapshot.context.report.resultEvents.length,
		watcherCount:
			snapshot.context.report.eventLog.length +
			snapshot.context.report.stateLog.length +
			snapshot.context.report.statesLog.length,
		agentStepCount: snapshot.context.report.agentLog.length,
		traceCount: snapshot.context.report.storySummary.traceCount,
		lifecycleCount: snapshot.context.report.storySummary.lifecycleCount,
	}),
	commands: ({ actor }) => ({
		inspect: () => actor.send({ type: "INSPECT" }),
		runIncrement: () => actor.send({ type: "RUN", command: "increment" }),
		runIncrementToLimit: () =>
			actor.send({ type: "RUN", command: "incrementToLimit" }),
		runDecrement: () => actor.send({ type: "RUN", command: "decrement" }),
		runReset: () => actor.send({ type: "RUN", command: "reset" }),
		setRuntimeStepDraft: (step: number) =>
			actor.send({ type: "SET_STEP_DRAFT", step }),
		setRuntimeLimitDraft: (limit: number) =>
			actor.send({ type: "SET_LIMIT_DRAFT", limit }),
		applyRuntimeStep: () => actor.send({ type: "APPLY_STEP" }),
		applyRuntimeLimit: () => actor.send({ type: "APPLY_LIMIT" }),
	}),
});

agentRuntimeShowcase("xstate-agent-runtime-showcase", (ctx) => (
	<section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
		<style>{twStyles}</style>
		<div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
			<div>
				<p class="text-sm font-semibold uppercase tracking-wide text-cyan-700">
					Agent runtime
				</p>
				<h2 class="mt-1 text-2xl font-bold text-slate-900">
					{ctx.report.command}
				</h2>
				<p class="mt-2 text-sm text-slate-600">
					Headless count: <strong>{ctx.report.states.count}</strong> · State:{" "}
					<strong>{ctx.report.states.stateLabel}</strong> · Events:{" "}
					<strong>{ctx.eventCount}</strong> · Watchers:{" "}
					<strong>{ctx.watcherCount}</strong> · Agent steps:{" "}
					<strong>{ctx.agentStepCount}</strong> · Trace:{" "}
					<strong>{ctx.traceCount}</strong> · Lifecycle:{" "}
					<strong>{ctx.lifecycleCount}</strong>
				</p>
			</div>
			<button
				type="button"
				class="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
				onClick={() => ctx.inspect()}
			>
				Inspect contract
			</button>
		</div>

		<div
			class="mt-6"
			style={{
				display: "grid",
				gap: "1rem",
				gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
			}}
		>
			<button
				type="button"
				class="rounded border border-slate-300 px-4 py-2 font-semibold"
				style={{ backgroundColor: "#0f766e", color: "#ffffff" }}
				onClick={() => ctx.runIncrement()}
			>
				Execute increment
			</button>
			<button
				type="button"
				class="rounded border border-slate-300 px-4 py-2 font-semibold"
				style={{ backgroundColor: "#047857", color: "#ffffff" }}
				onClick={() => ctx.runIncrementToLimit()}
			>
				Increment to ctx.limit
			</button>
			<button
				type="button"
				class="rounded border border-slate-300 px-4 py-2 font-semibold"
				style={{ backgroundColor: "#334155", color: "#ffffff" }}
				onClick={() => ctx.runDecrement()}
			>
				Execute decrement
			</button>
			<button
				type="button"
				class="rounded border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
				onClick={() => ctx.runReset()}
			>
				Execute reset
			</button>
		</div>

		<div class="mt-6 grid gap-4 md:grid-cols-2">
			<div>
				<label class="block text-sm font-medium text-slate-700">
					Payload for setStep: {ctx.step}
					<input
						class="mt-2 w-full accent-cyan-700"
						type="range"
						min={1}
						max={4}
						value={ctx.step}
						onInput={(event: Event) =>
							ctx.setRuntimeStepDraft(readNumber(event, ctx.step))
						}
					/>
				</label>
				<button
					type="button"
					class="mt-3 w-full rounded border border-slate-300 px-4 py-2 font-semibold"
					style={{ backgroundColor: "#0e7490", color: "#ffffff" }}
					onClick={() => ctx.applyRuntimeStep()}
				>
					Execute setStep
				</button>
			</div>
			<div>
				<label class="block text-sm font-medium text-slate-700">
					Payload for setLimit: {ctx.limit}
					<input
						class="mt-2 w-full accent-cyan-700"
						type="range"
						min={3}
						max={12}
						value={ctx.limit}
						onInput={(event: Event) =>
							ctx.setRuntimeLimitDraft(readNumber(event, ctx.limit))
						}
					/>
				</label>
				<button
					type="button"
					class="mt-3 w-full rounded border border-slate-300 px-4 py-2 font-semibold"
					style={{ backgroundColor: "#0e7490", color: "#ffffff" }}
					onClick={() => ctx.applyRuntimeLimit()}
				>
					Execute setLimit
				</button>
			</div>
		</div>

		<div class="mt-6 grid gap-4">
			<div class="min-w-0 rounded border border-slate-200 bg-slate-50 p-4">
				<h3 class="text-sm font-semibold text-slate-800">Runtime call</h3>
				<pre class="mt-3 overflow-auto rounded bg-slate-950 p-3 text-xs text-cyan-100">
					<code>{ctx.report.code}</code>
				</pre>
			</div>

			<div class="min-w-0 rounded border border-slate-200 bg-slate-50 p-4">
				<h3 class="text-sm font-semibold text-slate-800">getSchema()</h3>
				<dl class="mt-3 grid gap-2 text-sm text-slate-700">
					<div>
						<dt class="font-medium text-slate-900">Commands</dt>
						<dd class="break-words">
							{Object.keys(ctx.report.schema.commands).join(", ")}
						</dd>
					</div>
					<div>
						<dt class="font-medium text-slate-900">Events</dt>
						<dd class="break-words">
							{ctx.report.schema.events.map((event) => event.type).join(", ")}
						</dd>
					</div>
					<div class="min-w-0">
						<dt class="font-medium text-slate-900">Command metadata</dt>
						<dd class="min-w-0">
							<pre class="mt-2 overflow-auto rounded bg-white p-3 text-xs text-slate-700">
								<code>{formatJson(ctx.report.schema.commands)}</code>
							</pre>
						</dd>
					</div>
				</dl>
			</div>
		</div>

		<div class="mt-4 grid gap-4">
			<div class="min-w-0 rounded border border-slate-200 bg-slate-50 p-4">
				<h3 class="text-sm font-semibold text-slate-800">getSnapshot()</h3>
				<pre class="mt-3 overflow-auto rounded bg-white p-3 text-xs text-slate-700">
					<code>{formatJson(ctx.report.state)}</code>
				</pre>
			</div>

			<div class="min-w-0 rounded border border-slate-200 bg-slate-50 p-4">
				<h3 class="text-sm font-semibold text-slate-800">getStates()</h3>
				<pre class="mt-3 overflow-auto rounded bg-white p-3 text-xs text-slate-700">
					<code>{formatJson(ctx.report.states)}</code>
				</pre>
			</div>
		</div>

		<div class="mt-4 rounded border border-slate-200 bg-slate-50 p-4">
			<h3 class="text-sm font-semibold text-slate-800">Agent decision trace</h3>
			<ol class="mt-3 grid gap-2 text-sm text-slate-700">
				{ctx.report.agentLog.map((entry, index) => (
					<li class="rounded bg-white px-3 py-2" key={`${entry}-${index}`}>
						{entry}
					</li>
				))}
			</ol>
		</div>

		<div class="mt-4 grid gap-4">
			<div class="min-w-0 rounded border border-slate-200 bg-slate-50 p-4">
				<h3 class="text-sm font-semibold text-slate-800">story.trace()</h3>
				<ol class="mt-3 grid gap-2 text-sm text-slate-700">
					{ctx.report.traceLog.length ? (
						ctx.report.traceLog.map((entry, index) => (
							<li class="rounded bg-white px-3 py-2" key={`${entry}-${index}`}>
								{entry}
							</li>
						))
					) : (
						<li class="rounded bg-white px-3 py-2">No behavior entries</li>
					)}
				</ol>
			</div>

			<div class="min-w-0 rounded border border-slate-200 bg-slate-50 p-4">
				<h3 class="text-sm font-semibold text-slate-800">story.lifecycle()</h3>
				<ol class="mt-3 grid gap-2 text-sm text-slate-700">
					{ctx.report.lifecycleLog.length ? (
						ctx.report.lifecycleLog.map((entry, index) => (
							<li class="rounded bg-white px-3 py-2" key={`${entry}-${index}`}>
								{entry}
							</li>
						))
					) : (
						<li class="rounded bg-white px-3 py-2">No lifecycle entries</li>
					)}
				</ol>
			</div>
		</div>

		<div class="mt-4 grid gap-4">
			<div class="min-w-0 rounded border border-slate-200 bg-slate-50 p-4">
				<h3 class="text-sm font-semibold text-slate-800">
					execute(...) events
				</h3>
				<ul class="mt-3 grid gap-2 text-sm text-slate-700">
					{ctx.report.resultEvents.length ? (
						ctx.report.resultEvents.map((event, index) => (
							<li
								class="rounded bg-white px-3 py-2"
								key={`${event.type}-${index}`}
							>
								{event.type}: {formatEventFields(event)}
							</li>
						))
					) : (
						<li class="rounded bg-white px-3 py-2">No emitted events</li>
					)}
				</ul>
			</div>

			<div class="min-w-0 rounded border border-slate-200 bg-slate-50 p-4">
				<h3 class="text-sm font-semibold text-slate-800">
					on / watch / watchStates
				</h3>
				<ul class="mt-3 grid gap-2 text-sm text-slate-700">
					{[
						...ctx.report.eventLog,
						...ctx.report.stateLog,
						...ctx.report.statesLog,
					].length ? (
						[
							...ctx.report.eventLog,
							...ctx.report.stateLog,
							...ctx.report.statesLog,
						].map((entry, index) => (
							<li class="rounded bg-white px-3 py-2" key={`${entry}-${index}`}>
								{entry}
							</li>
						))
					) : (
						<li class="rounded bg-white px-3 py-2">No watcher changes</li>
					)}
				</ul>
			</div>
		</div>
	</section>
));
