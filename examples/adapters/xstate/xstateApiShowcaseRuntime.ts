import { igniteCore, matchState } from "ignite-element/xstate";
import { apiShowcaseMachine } from "./apiShowcaseMachine";

export const apiShowcase = igniteCore({
	source: apiShowcaseMachine,
	events: (event) => ({
		"api-count-changed": event<{
			count: number;
			previousCount: number;
			state: string;
		}>(),
		"api-limit-reached": event<{
			count: number;
			limit: number;
		}>(),
		"api-reset": event<{
			previousCount: number;
		}>(),
	}),
	states: (snapshot) => {
		const progress = Math.round(
			(snapshot.context.count / snapshot.context.limit) * 100,
		);

		return {
			count: snapshot.context.count,
			limit: snapshot.context.limit,
			step: snapshot.context.step,
			lastCommand: snapshot.context.lastCommand,
			history: [...snapshot.context.history].reverse(),
			stateValue: String(snapshot.value),
			stateLabel: matchState(
				snapshot,
				{
					active: "Active",
					limited: "Limit reached",
				},
				"Active",
			),
			progress,
			canDecrease: snapshot.context.count > 0,
			isLimited: snapshot.matches("limited"),
		};
	},
	commands: ({ actor, command }) => ({
		increment: command(
			() =>
				actor.send({ type: "ADD", amount: actor.getSnapshot().context.step }),
			{
				description: "Add the current step to the count.",
			},
		),
		decrement: command(() => actor.send({ type: "DECREMENT" }), {
			description: "Decrease the count by one.",
		}),
		setLimit: command(
			(limit: number) => actor.send({ type: "SET_LIMIT", limit }),
			{
				description: "Set maximum count before the limited state is reached.",
				input: command.number({ minimum: 3, maximum: 12 }),
			},
		),
		setStep: command((step: number) => actor.send({ type: "SET_STEP", step }), {
			description: "Set the amount added by the increment command.",
			input: command.number({ minimum: 1, maximum: 4 }),
		}),
		reset: command(() => actor.send({ type: "RESET" }), {
			description: "Reset the count to zero.",
		}),
	}),
	effects: ({ emit, select, snapshot, prevSnapshot }) => {
		const count = select((state) => state.context.count);
		if (count.changed) {
			emit({
				type: "api-count-changed",
				count: count.current,
				previousCount: count.previous,
				state: String(snapshot.value),
			});
		}

		const limitReached = select((state) => state.matches("limited"));
		if (limitReached.changed && limitReached.current) {
			emit({
				type: "api-limit-reached",
				count: snapshot.context.count,
				limit: snapshot.context.limit,
			});
		}

		if (prevSnapshot.context.count > 0 && snapshot.context.count === 0) {
			emit({
				type: "api-reset",
				previousCount: prevSnapshot.context.count,
			});
		}
	},
});

declare global {
	interface Window {
		__igniteExamples?: {
			apiShowcase?: typeof apiShowcase;
		};
	}
}

if (typeof window !== "undefined") {
	window.__igniteExamples = {
		...window.__igniteExamples,
		apiShowcase,
	};
}
