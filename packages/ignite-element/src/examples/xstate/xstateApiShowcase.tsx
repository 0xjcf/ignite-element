// Tailwind classes need to reach this component's Shadow DOM; inject the built
// sheet as raw text (config-free). See xstateExample.tsx for the rationale.
import twStyles from "./dist/styles.css?raw";
import { apiShowcase } from "./xstateApiShowcaseRuntime";

const readNumber = (event: Event, fallback: number) => {
	const input = event.currentTarget as HTMLInputElement | null;
	const value = Number(input?.value);
	return Number.isFinite(value) ? value : fallback;
};

apiShowcase("xstate-api-showcase", (ctx) => (
	<section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
		<style>{twStyles}</style>
		<div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
			<div>
				<p class="text-sm font-semibold uppercase tracking-wide text-indigo-600">
					XState API showcase
				</p>
				<h2 class="mt-1 text-2xl font-bold text-slate-900">
					Count {ctx.count} / {ctx.limit}
				</h2>
				<p class="mt-2 text-sm text-slate-600">
					State: <strong>{ctx.stateLabel}</strong> ({ctx.stateValue}) · Last
					command: <strong>{ctx.lastCommand}</strong>
				</p>
			</div>
			<div
				class={`rounded-full px-3 py-1 text-sm font-semibold ${
					ctx.isLimited
						? "bg-rose-100 text-rose-700"
						: "bg-emerald-100 text-emerald-700"
				}`}
			>
				{ctx.isLimited ? "Effects emitted ctx.limit event" : "Effects watching"}
			</div>
		</div>

		<div class="mt-6 h-3 overflow-hidden rounded-full bg-slate-100">
			<div
				class="h-full rounded-full bg-indigo-500 transition-all"
				style={{ width: `${ctx.progress}%` }}
			/>
		</div>

		<div class="mt-6 grid gap-4 md:grid-cols-2">
			<label class="block text-sm font-medium text-slate-700">
				Step: {ctx.step}
				<input
					class="mt-2 w-full accent-indigo-600"
					type="range"
					min={1}
					max={4}
					value={ctx.step}
					onInput={(event: Event) => ctx.setStep(readNumber(event, ctx.step))}
				/>
			</label>
			<label class="block text-sm font-medium text-slate-700">
				Limit: {ctx.limit}
				<input
					class="mt-2 w-full accent-indigo-600"
					type="range"
					min={3}
					max={12}
					value={ctx.limit}
					onInput={(event: Event) => ctx.setLimit(readNumber(event, ctx.limit))}
				/>
			</label>
		</div>

		<div class="mt-6 flex flex-wrap gap-3">
			<button
				type="button"
				class="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
				onClick={() => ctx.increment()}
			>
				Add ctx.step
			</button>
			<button
				type="button"
				class="rounded bg-slate-700 px-4 py-2 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={!ctx.canDecrease}
				onClick={() => ctx.decrement()}
			>
				Decrease
			</button>
			<button
				type="button"
				class="rounded border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
				onClick={() => ctx.reset()}
			>
				Reset
			</button>
		</div>

		<ol class="mt-6 grid gap-2 text-sm text-slate-700">
			{ctx.history.map((entry) => (
				<li class="rounded bg-slate-50 px-3 py-2" key={entry}>
					{entry}
				</li>
			))}
		</ol>
	</section>
));
