import { apiShowcase } from "./xstateApiShowcaseRuntime";

const readNumber = (event: Event, fallback: number) => {
	const input = event.currentTarget as HTMLInputElement | null;
	const value = Number(input?.value);
	return Number.isFinite(value) ? value : fallback;
};

apiShowcase(
	"xstate-api-showcase",
	({
		count,
		limit,
		step,
		stateLabel,
		stateValue,
		progress,
		lastCommand,
		history,
		canDecrease,
		isLimited,
		increment,
		decrement,
		setLimit,
		setStep,
		reset,
	}) => (
		<section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
			<div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
				<div>
					<p class="text-sm font-semibold uppercase tracking-wide text-indigo-600">
						XState API showcase
					</p>
					<h2 class="mt-1 text-2xl font-bold text-slate-900">
						Count {count} / {limit}
					</h2>
					<p class="mt-2 text-sm text-slate-600">
						State: <strong>{stateLabel}</strong> ({stateValue}) · Last command:{" "}
						<strong>{lastCommand}</strong>
					</p>
				</div>
				<div
					class={`rounded-full px-3 py-1 text-sm font-semibold ${
						isLimited
							? "bg-rose-100 text-rose-700"
							: "bg-emerald-100 text-emerald-700"
					}`}
				>
					{isLimited ? "Effects emitted limit event" : "Effects watching"}
				</div>
			</div>

			<div class="mt-6 h-3 overflow-hidden rounded-full bg-slate-100">
				<div
					class="h-full rounded-full bg-indigo-500 transition-all"
					style={{ width: `${progress}%` }}
				/>
			</div>

			<div class="mt-6 grid gap-4 md:grid-cols-2">
				<label class="block text-sm font-medium text-slate-700">
					Step: {step}
					<input
						class="mt-2 w-full accent-indigo-600"
						type="range"
						min={1}
						max={4}
						value={step}
						onInput={(event: Event) => setStep(readNumber(event, step))}
					/>
				</label>
				<label class="block text-sm font-medium text-slate-700">
					Limit: {limit}
					<input
						class="mt-2 w-full accent-indigo-600"
						type="range"
						min={3}
						max={12}
						value={limit}
						onInput={(event: Event) => setLimit(readNumber(event, limit))}
					/>
				</label>
			</div>

			<div class="mt-6 flex flex-wrap gap-3">
				<button
					type="button"
					class="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
					onClick={() => increment()}
				>
					Add step
				</button>
				<button
					type="button"
					class="rounded bg-slate-700 px-4 py-2 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={!canDecrease}
					onClick={() => decrement()}
				>
					Decrease
				</button>
				<button
					type="button"
					class="rounded border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
					onClick={() => reset()}
				>
					Reset
				</button>
			</div>

			<ol class="mt-6 grid gap-2 text-sm text-slate-700">
				{history.map((entry) => (
					<li class="rounded bg-slate-50 px-3 py-2" key={entry}>
						{entry}
					</li>
				))}
			</ol>
		</section>
	),
);
