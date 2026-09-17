import { createMobXAdapter } from "@ignite-element/adapters/mobx";
import { igniteCore, type MobxConfig } from "ignite-element/mobx";
import { makeAutoObservable } from "mobx";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B
	? 1
	: 2
	? true
	: false;

class Counter {
	count = 0;
	constructor() {
		makeAutoObservable(this);
	}
	increment(amount = 1) {
		this.count += amount;
		return this.count;
	}
}

// Compile-only contracts, also copied unchanged into the strict packed consumer.
export function mobxFactoryContracts() {
	createMobXAdapter(() => new Counter());
	const core = igniteCore({
		source: () => new Counter(),
		states: (snapshot) => {
			const exact: Equal<typeof snapshot, Counter> = true;
			void exact;
			// @ts-expect-error Snapshot fields do not widen.
			snapshot.missing;
			return { count: snapshot.count };
		},
		commands: ({ source: store }) => {
			const exact: Equal<typeof store, Counter> = true;
			void exact;
			// @ts-expect-error Resolved source is the observable, not its factory.
			store();
			// @ts-expect-error Invalid native method.
			store.dispatch({ type: "increment" });
			return { increment: (amount: number) => store.increment(amount) };
		},
	});
	core("mobx-factory-types", (ctx) => {
		const exact: Equal<typeof ctx.increment, (amount: number) => number> = true;
		void exact;
		// @ts-expect-error Command inputs retain their type.
		ctx.increment("bad");
		return null;
	});
	const states = core.get("states");
	const exact: Equal<typeof states, { count: number }> = true;
	void exact;
	core.execute({ command: "increment", input: 2 });
	// @ts-expect-error Headless command inputs retain their type.
	core.execute({ command: "increment", input: "bad" });
	igniteCore({ source: () => new Counter(), adapter: "mobx" });
	igniteCore({ source: new Counter() });
	igniteCore({
		source: () => new Counter(),
		commands: ({ source }) => ({ increment: () => source.increment() }),
	});
	const annotated: MobxConfig<Counter> = { source: () => new Counter() };
	igniteCore(annotated);
	// @ts-expect-error Dedicated import rejects a mismatched adapter.
	igniteCore({ source: () => new Counter(), adapter: "redux" });
	// @ts-expect-error A primitive is not a MobX source.
	igniteCore({ source: 1 });
	igniteCore({
		source: () => new Counter(),
		// @ts-expect-error actor was removed from command contexts.
		commands: ({ actor }) => ({ increment: () => actor.increment() }),
	});
}
