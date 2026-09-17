import assert from "node:assert/strict";

const [entry, scenario = "import"] = process.argv.slice(2);
const browserNames = ["HTMLElement", "customElements", "document", "window"];
const before = browserNames.map((name) =>
	Object.getOwnPropertyDescriptor(globalThis, name),
);
assert.ok(
	before.every((value) => value === undefined),
	"probe must start without browser globals",
);
const native = [EventTarget, Event, CustomEvent];
function unchanged() {
	assert.deepEqual(
		browserNames.map((name) =>
			Object.getOwnPropertyDescriptor(globalThis, name),
		),
		before,
		"browser globals changed",
	);
	assert.deepEqual(
		[EventTarget, Event, CustomEvent],
		native,
		"native event constructors changed",
	);
}
if (scenario === "fake-control") {
	Object.defineProperty(globalThis, "HTMLElement", { value: class {} });
	unchanged();
}
if (scenario === "access-control") {
	Object.defineProperty(globalThis, "document", {
		get() {
			throw new Error("premature browser access detected");
		},
	});
	void globalThis.document;
}
const imported = await import(entry);
unchanged();
if (scenario === "root") {
	for (const args of [[], [undefined], [{}]]) {
		const core = imported.igniteCore(...args);
		assert.equal(typeof core, "function");
		for (const name of ["getStates", "execute", "watchStates", "on", "record"])
			assert.equal(name in core, false);
		unchanged();
		assert.throws(() => core("node-layout", () => null), /DOM registration/);
		unchanged();
	}
}
if (scenario.includes("-live") || scenario.includes("-factory")) {
	const [kind, lifetime] = scenario.split("-");
	let source;
	let close = () => {};
	let read = (snapshot) => snapshot.count;
	let sourcesCreated = 0;
	const ownedObservations = new Set();
	if (kind === "xstate") {
		const { createMachine, createActor, assign } = await import("xstate");
		const machine = createMachine({
			context: { count: 0 },
			on: {
				INC: { actions: assign({ count: ({ context }) => context.count + 1 }) },
			},
		});
		if (lifetime === "factory") source = machine;
		else {
			source = createActor(machine).start();
			close = () => source.stop();
		}
		read = (snapshot) => snapshot.context.count;
	} else if (kind === "redux") {
		const { configureStore, createSlice } = await import("@reduxjs/toolkit");
		const slice = createSlice({
			name: "counter",
			initialState: { count: 0 },
			reducers: {
				inc(state) {
					state.count += 1;
				},
			},
		});
		source =
			lifetime === "factory"
				? slice
				: configureStore({ reducer: slice.reducer });
	} else if (kind === "mobx") {
		const { makeAutoObservable } = await import("mobx");
		const make = () =>
			makeAutoObservable({
				count: 0,
				inc() {
					this.count += 1;
				},
			});
		source = lifetime === "factory" ? make : make();
	} else if (kind === "actor") {
		await import("@actor-web/runtime");
		const make = () => {
			sourcesCreated += 1;
			let count = 0;
			const snapshot = () => ({
				address: "counter",
				context: { count },
				phase: "ready",
				toJSON: () => ({ count }),
			});
			return {
				address: "counter",
				snapshot,
				subscribe(listener) {
					ownedObservations.add(listener);
					return () => ownedObservations.delete(listener);
				},
				async send() {
					count += 1;
					for (const listener of ownedObservations) listener(snapshot());
				},
				close() {
					throw new Error(
						"Ignite must not close a source after observation cleanup",
					);
				},
			};
		};
		source = lifetime === "factory" ? make : make();
		read = (snapshot) => snapshot.context.count;
	}
	const core = imported.igniteCore({
		source,
		states: (snapshot) => ({ count: read(snapshot) }),
		events: (event) => ({ changed: event() }),
		commands: ({ source: actor }) => ({
			increment: () =>
				kind === "redux"
					? actor.dispatch({ type: "counter/inc" })
					: kind === "mobx"
						? actor.inc()
						: actor.send({ type: "INC" }),
		}),
		effects: ({ select, emit }) => {
			const count = select(read);
			if (count.changed) emit({ type: "changed", count: count.current });
		},
	});
	try {
		unchanged();
		const beforeRegistration = sourcesCreated;
		assert.throws(() => core("node-counter", () => null), /DOM registration/);
		assert.equal(sourcesCreated, beforeRegistration);
		unchanged();
		// A present document must not turn headless runtime access into DOM allocation.
		Object.defineProperty(globalThis, "document", {
			configurable: true,
			get() {
				throw new Error("premature browser access detected");
			},
		});
		assert.equal(core.get("states").count, 0);
		Reflect.deleteProperty(globalThis, "document");
		unchanged();
		let delivered = 0;
		const facts = [];
		const first = core.watch(() => {});
		const second = core.watch(() => {
			delivered += 1;
		});
		const events = core.on("changed", (fact) => facts.push(fact));
		first.unsubscribe();
		first.unsubscribe();
		unchanged();
		const result = await core.execute({ command: "increment" });
		assert.equal(result.states.count, 1);
		assert.equal(read(result.snapshot), 1);
		assert.deepEqual(result.events, [{ type: "changed", count: 1 }]);
		assert.deepEqual(facts, [{ type: "changed", count: 1 }]);
		assert.equal(delivered, 1);
		unchanged();
		second.unsubscribe();
		second.unsubscribe();
		events.unsubscribe();
		events.unsubscribe();
		await core.execute({ command: "increment" });
		assert.equal(core.get("states").count, 2);
		assert.equal(delivered, 1);
		assert.equal(facts.length, 1);
		unchanged();
		await assert.rejects(
			core.execute({ command: "missing" }),
			/Unknown command/,
		);
		unchanged();
		const { createProjectionDocumentTarget } = await import("ignite-element");
		const session = core(
			createProjectionDocumentTarget({ commitDocument() {} }),
		);
		session.dispose();
		session.dispose();
		await Promise.resolve();
		unchanged();
	} finally {
		Reflect.deleteProperty(globalThis, "document");
		ownedObservations.clear();
		close();
	}
}
console.log(`PASS ${entry} ${scenario}`);
