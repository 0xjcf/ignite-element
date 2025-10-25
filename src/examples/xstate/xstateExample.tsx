import { type ActorRefFrom, createActor, type StateFrom } from "xstate";
import { igniteCore } from "../../IgniteCore";
import type { AdapterPack } from "../../IgniteElementFactory";
import { advancedMachine } from "./advancedCounterMachine";

// Start a single actor that will be shared by every component registered with
// `registerSharedXState`. Each element stays in sync because the same actor
// instance is reused under the hood.
const sharedActor = createActor(advancedMachine).start();

type MachineSnapshot = StateFrom<typeof advancedMachine>;
type MachineActor = ActorRefFrom<typeof advancedMachine>;

const xstateStates = (snapshot: MachineSnapshot) => {
	const darkMode = snapshot.context.darkMode;
	const containerClasses = darkMode
		? "p-4 bg-gray-800 text-white border rounded-md mb-2"
		: "p-4 bg-gray-100 text-black border rounded-md mb-2";

	return {
		count: snapshot.context.count,
		value: snapshot.value,
		darkMode,
		containerClasses,
	};
};

const xstateCommands = (actor: MachineActor) => ({
	increment: () => actor.send({ type: "INC" }),
	decrement: () => actor.send({ type: "DEC" }),
	toggleDarkMode: () => actor.send({ type: "TOGGLE_DARK" }),
});

const component = igniteCore({
	source: sharedActor,
	states: xstateStates,
	commands: xstateCommands,
});

// Isolated components receive a fresh actor per registration.
const registerIsolatedXState = igniteCore({
	source: advancedMachine,
	states: xstateStates,
	commands: xstateCommands,
});

// Shared Counter Component (XState)
component(
	"my-counter-xstate",
	({ count, increment, decrement, containerClasses }) => (
		<div class={containerClasses}>
			<h3 class="text-lg font-bold">Shared Counter (XState)</h3>
			<p class="text-xl">Count: {count}</p>
			<div class="mt-4 space-x-2">
				<button
					type="button"
					class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
					onClick={() => decrement()}
				>
					-
				</button>
				<button
					type="button"
					class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
					onClick={() => increment()}
				>
					+
				</button>
			</div>
		</div>
	),
);

// Shared Display Component (XState)
component("shared-display-xstate", ({ count }) => (
	<div class="p-4 bg-blue-100 border rounded-md mb-2">
		<h3 class="text-lg font-bold text-blue-800">
			Shared State Display (XState)
		</h3>
		<p class="text-xl text-blue-700">Shared Count: {count}</p>
	</div>
));

// Isolated Counter Component (XState)
registerIsolatedXState(
	"another-counter-xstate",
	({ count, increment, decrement }) => (
		<div class="p-4 bg-yellow-100 border rounded-md mb-2">
			<h3 class="text-lg font-bold text-yellow-800">
				Isolated Counter (XState)
			</h3>
			<p class="text-xl text-yellow-700">Count: {count}</p>
			<div class="mt-4 space-x-2">
				<button
					type="button"
					class="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
					onClick={() => decrement()}
				>
					-
				</button>
				<button
					type="button"
					class="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600"
					onClick={() => increment()}
				>
					+
				</button>
			</div>
		</div>
	),
);

component("gradient-tally", ({ count }) => (
	<>
		<style>{`.box { height: 1rem; width: 1rem; border-radius: 50px; }`}</style>
		<div
			class="box"
			style={{
				background: `linear-gradient(90deg, rgba(34, 197, 94, 1) 0%, rgba(59, 130, 246, ${(count + 1) / 10}) 100%)`,
			}}
		/>
	</>
));

export class AdvancedSharedCounter {
	render({
		count,
		increment,
		decrement,
		toggleDarkMode,
		containerClasses,
	}: AdapterPack<typeof component>) {
		return (
			<div class={containerClasses}>
				<h3 class="text-lg font-bold">Advanced Counter</h3>

				<p class="text-xl">Count: {count}</p>

				<div class="mt-4 space-x-2">
					<button
						type="button"
						class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
						onClick={() => decrement()}
					>
						-
					</button>
					<button
						type="button"
						class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
						onClick={() => increment()}
					>
						+
					</button>
				</div>

				<div class="mt-4">
					<button
						type="button"
						class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
						onClick={() => toggleDarkMode()}
					>
						Toggle Dark Mode
					</button>
				</div>

				<div class="mt-4 flex flex-wrap gap-2 items-center">
					{Array.from({ length: count }).map(() => (
						<gradient-tally />
					))}
				</div>
			</div>
		);
	}
}

component("advanced-shared-counter", AdvancedSharedCounter);
