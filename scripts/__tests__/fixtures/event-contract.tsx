import type { EventDescriptor } from "@ignite-element/core";
import { igniteCore as staticCore } from "ignite-element";
import {
	type ActorWebCommandSource,
	igniteCore as actorCore,
} from "ignite-element/actor-web";
import { igniteCore as hostCore } from "ignite-element/actor-web/web";
import { igniteReact } from "ignite-element/react/web";
import {
	type IgniteCoreReturn,
	igniteCore as machineCore,
} from "ignite-element/xstate";
import { createElement } from "react";
import { createActor, setup } from "xstate";

type Reset = { type: "reset"; count: number };
const snapshot = () => ({
	address: "fixture",
	context: { count: 0 },
	phase: "ready",
	toJSON: () => ({}),
});
const source = {
	address: "fixture",
	snapshot,
	subscribe:
		(_listener: (value: ReturnType<typeof snapshot>) => void) => () => {},
	subscribeEvent: (_listener: (event: Reset) => void) => () => {},
	send: async (_message: Reset) => {},
};

declare const optionalDistinct: ActorWebCommandSource<
	{ count: number },
	{ type: "INCREMENT" },
	Reset
>;
declare const legacyAlias: IgniteCoreReturn<
	unknown,
	unknown,
	unknown,
	Record<never, never>,
	unknown,
	Record<never, never>,
	{ reset: EventDescriptor<{ count: number }> }
>;

// Compile-only: construction/registration below is never executed by this fixture.
export function eventContract() {
	const LegacyView = igniteReact(legacyAlias("legacy-alias", () => null));
	createElement(LegacyView, {
		onReset: (detail) => {
			const count: number = detail.count;
			void count;
		},
	});
	const legacyOptional = actorCore({ source: optionalDistinct });
	legacyOptional.on("reset", (event) => {
		const count: number = event.count;
		void count;
	});
	actorCore({
		source: optionalDistinct,
		events: (e) => ({ reset: e<{ count: number }>() }),
		effects: ({ emit }) => {
			emit({ type: "reset", count: 0 });
		},
	});
	const OptionalView = igniteReact(
		legacyOptional("optional-native-event", () => null),
	);
	// @ts-expect-error Legacy headless typing does not declare DOM callbacks.
	createElement(OptionalView, { onReset: () => {} });
	// @ts-expect-error The public root remains source-free.
	staticCore({ source });
	const instance = actorCore({
		source,
		states: (s) => ({ count: s.context.count }),
		commands: ({ actor }) => ({
			reset: () => actor.send({ type: "reset", count: 0 }),
		}),
	});
	instance.on("reset", (event) => {
		const count: number = event.count;
		// @ts-expect-error Native payload is number, not string.
		const text: string = event.count;
		// @ts-expect-error Unknown payload fields remain rejected.
		event.missing;
		void count;
		void text;
	});
	void instance.execute({ command: "reset" }).then(({ events }) => {
		for (const event of events) {
			const type: "reset" = event.type;
			const count: number = event.count;
			void type;
			void count;
		}
	});
	const factory = actorCore({ source: () => source });
	factory.on("reset", (event) => {
		const count: number = event.count;
		void count;
	});
	const subset = actorCore({
		source: {
			...source,
			send: async (
				_message: Reset | { type: "increment" },
			): Promise<void> => {},
		},
	});
	subset.on("reset", (event) => {
		const count: number = event.count;
		void count;
	});
	const overlap = actorCore({
		source: {
			...source,
			send: async (
				_message: Reset | { type: "increment" },
			): Promise<void> => {},
			subscribeEvent:
				(
					_listener: (
						event: Reset | { type: "changed"; value: number },
					) => void,
				) =>
				() => {},
		},
	});
	overlap.on("changed", (event) => {
		const value: number = event.value;
		void value;
	});
	overlap.on("reset", (event) => {
		const count: number = event.count;
		void count;
	});
	const distinct = actorCore({
		source: {
			...source,
			send: async (_message: { type: "INCREMENT" }): Promise<void> => {},
		},
	});
	distinct.on("reset", (event) => {
		const count: number = event.count;
		void count;
	});

	const HiddenActor = igniteReact(
		instance("hidden-actor-event", (ctx) => {
			const count: number = ctx.count;
			ctx.reset();
			return String(count);
		}),
	);
	// @ts-expect-error A native headless event is not an undeclared DOM callback.
	createElement(HiddenActor, { onReset: () => {} });
	const declaredActor = actorCore({
		source,
		events: (e) => ({
			reset: e<{ count: number }>(),
			changed: e<{ count: number }>(),
		}),
		effects: ({ emit }) => {
			emit({ type: "changed", count: 1 });
			// @ts-expect-error Declaration exposes the native event, not a second producer.
			emit({ type: "reset", count: 1 });
		},
	});
	const ActorView = igniteReact(
		declaredActor("declared-actor-event", () => null),
	);
	createElement(ActorView, {
		onReset: (detail) => {
			const count: number = detail.count;
			void count;
		},
	});
	actorCore({
		source,
		// @ts-expect-error Native numeric payload cannot be replaced with string.
		events: (e) => ({ reset: e<{ count: string }>() }),
	});

	const host = hostCore({
		source: (_context: { host?: HTMLElement }) => source,
	});
	const HostView = igniteReact(host("hidden-host-event", () => null));
	// @ts-expect-error Host-only factories have the same declared DOM boundary.
	createElement(HostView, { onReset: () => {} });
	const declaredHost = hostCore({
		source: (_context: { host?: HTMLElement }) => source,
		events: (e) => ({ reset: e<{ count: number }>() }),
	});
	const DeclaredHost = igniteReact(
		declaredHost("declared-host-event", () => null),
	);
	createElement(DeclaredHost, {
		onReset: (detail) => {
			const count: number = detail.count;
			void count;
		},
	});
	// No headless acquisition is attempted for a host-dependent factory.

	const machine = setup({
		types: { events: {} as Reset, emitted: {} as Reset },
	}).createMachine({});
	const nativeMachine = machineCore({ source: machine });
	const nativeActor = machineCore({ source: createActor(machine) });
	for (const core of [nativeMachine, nativeActor]) {
		core.on("reset", (event) => {
			const count: number = event.count;
			void count;
		});
		const View = igniteReact(core("hidden-xstate-event", () => null));
		// @ts-expect-error Native observation does not declare a component event.
		createElement(View, { onReset: () => {} });
	}
	const declared = machineCore({
		source: machine,
		events: (e) => ({
			reset: e<{ count: number }>(),
			changed: e<{ count: number }>(),
		}),
		effects: ({ emit }) => {
			emit({ type: "changed", count: 1 });
			// @ts-expect-error Declared native names are still reserved.
			emit({ type: "reset", count: 1 });
		},
	});
	const View = igniteReact(declared("declared-xstate-event", () => null));
	createElement(View, {
		onReset: (detail) => {
			const count: number = detail.count;
			void count;
		},
	});
	machineCore({
		source: machine,
		// @ts-expect-error Public declarations must accept native payloads.
		events: (e) => ({ reset: e<{ count: string }>() }),
	});

	const optional: Omit<typeof source, "subscribeEvent"> & {
		subscribeEvent?: typeof source.subscribeEvent;
	} = source;
	const { subscribeEvent: _channel, ...missing } = source;
	for (const unproven of [
		optional,
		missing,
		{
			...source,
			subscribeEvent:
				(_listener: (event: { type: string }) => void) => () => {},
		},
	]) {
		actorCore({
			source: unproven,
			events: (e) => ({ reset: e<{ count: number }>() }),
			effects: ({ emit }) => {
				emit({ type: "reset", count: 0 });
			},
		});
		const core = actorCore({ source: unproven });
		// @ts-expect-error Incoming commands do not establish a precise native channel.
		core.on("reset", () => {});
	}
}
