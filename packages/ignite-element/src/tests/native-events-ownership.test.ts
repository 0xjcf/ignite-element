import { igniteCore as actorCore } from "../actor-web";
import { igniteCore as webCore } from "../actor-web/web";
import { afterEach, describe, expect, it, vi } from "vitest";
let sequence = 0;
const cores: { dispose(): void }[] = [];
afterEach(() => {
	for (const core of cores.splice(0)) core.dispose();
	document.body.replaceChildren();
	vi.restoreAllMocks();
});
function sourceFixture() {
	const events = new Set<(event: { type: string; count: number }) => void>();
	type Snapshot = {
		address: string;
		context: { count: number };
		phase: string;
		toJSON: () => object;
	};
	const snapshots = new Set<(snapshot: Snapshot) => void>();
	let count = 0;
	const source = {
		address: "native-test",
		snapshot: () => ({
			address: "native-test",
			context: { count },
			phase: "active",
			toJSON: () => ({}),
		}),
		subscribe: (listener: (snapshot: Snapshot) => void) => {
			snapshots.add(listener);
			return () => snapshots.delete(listener);
		},
		subscribeEvent: (
			listener: (event: { type: string; count: number }) => void,
		) => {
			events.add(listener);
			return () => {
				events.delete(listener);
			};
		},
		close: vi.fn(),
	};
	return {
		source,
		events,
		snapshots,
		native: () => {
			for (const listener of events) listener({ type: "reset", count });
		},
		change: () => {
			count++;
			for (const listener of snapshots) listener(source.snapshot());
		},
	};
}
function connect(core: (tag: string, renderer: () => null) => unknown) {
	const tag = `native-owned-${sequence++}`;
	core(tag, () => null);
	const element = document.createElement(tag);
	const cls = customElements.get(tag);
	if (!cls) throw Error("missing class");
	return {
		element,
		connect: () => cls.prototype.connectedCallback.call(element),
		disconnect: () => cls.prototype.disconnectedCallback.call(element),
	};
}
describe("native ownership and diagnostic integration", () => {
	it.each(["shared", "isolated"] as const)(
		"stops %s synchronous acquisition emissions after disposal in a DOM listener",
		(mode) => {
			const f = sourceFixture(),
				release = vi.fn(),
				received = vi.fn(() => core.dispose());
			const core =
				mode === "shared"
					? actorCore({
							source: f.source,
							events: (event) => ({ reset: event<{ count: number }>() }),
						})
					: webCore({
							source: () => f.source,
							events: (event) => ({ reset: event<{ count: number }>() }),
						});
			cores.push(core);
			f.source.subscribeEvent = (listener) => {
				listener({ type: "reset", count: 1 });
				listener({ type: "reset", count: 2 });
				return release;
			};
			const view = connect(core);
			view.element.addEventListener("reset", received);
			expect(view.connect).toThrow(/disposed/);
			expect(received).toHaveBeenCalledTimes(1);
			expect(release).toHaveBeenCalledTimes(1);
			expect(f.snapshots.size).toBe(0);
		},
	);
	it.each(["shared", "isolated"] as const)(
		"rechecks %s lifetime after reentrant payload access",
		(mode) => {
			const f = sourceFixture(),
				release = vi.fn(),
				received = vi.fn();
			const core =
				mode === "shared"
					? actorCore({
							source: f.source,
							events: (event) => ({ reset: event<{ count: number }>() }),
						})
					: webCore({
							source: () => f.source,
							events: (event) => ({ reset: event<{ count: number }>() }),
						});
			cores.push(core);
			f.source.subscribeEvent = (listener) => {
				listener({
					type: "reset",
					get count() {
						core.dispose();
						return 1;
					},
				});
				return release;
			};
			const view = connect(core);
			view.element.addEventListener("reset", received);
			expect(view.connect).toThrow(/disposed/);
			expect(received).not.toHaveBeenCalled();
			expect(release).toHaveBeenCalledTimes(1);
		},
	);
	it.each(["shared", "isolated"] as const)(
		"makes %s callbacks inert before acquisition returns after disposal",
		(mode) => {
			const f = sourceFixture(),
				release = vi.fn(),
				received = vi.fn();
			const core =
				mode === "shared"
					? actorCore({
							source: f.source,
							events: (event) => ({ reset: event<{ count: number }>() }),
						})
					: webCore({
							source: () => f.source,
							events: (event) => ({ reset: event<{ count: number }>() }),
						});
			cores.push(core);
			f.source.subscribeEvent = (listener) => {
				core.dispose();
				listener({ type: "reset", count: 1 });
				listener({ type: "reset", count: 2 });
				return release;
			};
			const view = connect(core);
			view.element.addEventListener("reset", received);
			expect(view.connect).toThrow(/disposed/);
			expect(received).not.toHaveBeenCalled();
			expect(release).toHaveBeenCalledTimes(1);
			expect(f.snapshots.size).toBe(0);
			if (mode === "shared") expect(f.source.close).not.toHaveBeenCalled();
			else expect(f.source.close).toHaveBeenCalledTimes(1);
		},
	);
	it("separates isolated owners and does not monitor events before subscription", async () => {
		const instances: ReturnType<typeof sourceFixture>[] = [],
			log = vi.spyOn(console, "warn").mockImplementation(() => {});
		const core = webCore({
			source: () => {
				const f = sourceFixture();
				instances.push(f);
				return f.source;
			},
			events: (e) => ({ reset: e<{ count: number }>() }),
			effects: ({ select, emit }) => {
				const count = select((s) => s.context.count);
				if (count.changed) emit({ type: "reset", count: count.current });
			},
		});
		cores.push(core);
		const a = connect(core),
			b = connect(core);
		a.connect();
		b.connect();
		instances[0].native();
		instances[1].change();
		await Promise.resolve();
		await Promise.resolve();
		expect(log).not.toHaveBeenCalled();
		instances[0].change();
		await Promise.resolve();
		await Promise.resolve();
		expect(log).toHaveBeenCalledTimes(1);
		const missed = sourceFixture();
		const other = actorCore({
			source: missed.source,
			events: (e) => ({ reset: e<{ count: number }>() }),
			effects: ({ select, emit }) => {
				const count = select((s) => s.context.count);
				if (count.changed) emit({ type: "reset", count: count.current });
			},
		});
		cores.push(other);
		expect(missed.events.size).toBe(0);
		missed.native();
		const c = connect(other);
		c.connect();
		missed.change();
		await Promise.resolve();
		await Promise.resolve();
		expect(log).toHaveBeenCalledTimes(1);
	});
	it("releases a late subscription when the core is disposed during acquisition", () => {
		const f = sourceFixture(),
			subscribe = f.source.subscribeEvent;
		const core = actorCore({
			source: f.source,
			events: (e) => ({ reset: e<{ count: number }>() }),
		});
		cores.push(core);
		f.source.subscribeEvent = (listener) => {
			const release = subscribe(listener);
			core.dispose();
			return release;
		};
		const a = connect(core);
		expect(a.connect).toThrow(/disposed/);
		expect(f.events.size).toBe(0);
		expect(f.snapshots.size).toBe(0);
	});
	it.each(["native", "effect"] as const)(
		"observes both producers in %s order without deduplicating recipients",
		async (first) => {
			const f = sourceFixture(),
				log = vi.spyOn(console, "warn").mockImplementation(() => {});
			const core = actorCore({
				source: f.source,
				events: (e) => ({ reset: e<{ count: number }>() }),
				effects: ({ select, emit }) => {
					const count = select((s) => s.context.count);
					if (count.changed) emit({ type: "reset", count: count.current });
				},
			});
			cores.push(core);
			const a = connect(core),
				b = connect(core),
				dom = vi.fn(),
				head = vi.fn();
			a.element.addEventListener("reset", dom);
			b.element.addEventListener("reset", dom);
			a.connect();
			b.connect();
			core.on("reset", head);
			const effect = async () => {
				f.change();
				await Promise.resolve();
				await Promise.resolve();
			};
			if (first === "native") {
				f.native();
				await effect();
			} else {
				await effect();
				f.native();
			}
			expect(log).toHaveBeenCalledTimes(1);
			expect(dom).toHaveBeenCalledTimes(4);
			expect(head).toHaveBeenCalledTimes(2);
			f.native();
			f.native();
			await effect();
			expect(dom).toHaveBeenCalledTimes(10);
			expect(head).toHaveBeenCalledTimes(5);
			expect(log).toHaveBeenCalledTimes(1);
			core.dispose();
			expect(f.events.size).toBe(0);
			expect(f.snapshots.size).toBe(0);
			expect(f.source.close).not.toHaveBeenCalled();
		},
	);
	it("rolls back event acquisition and permits reconnect, without closing a borrowed source", () => {
		const f = sourceFixture(),
			subscribe = f.source.subscribeEvent;
		let fail = true;
		f.source.subscribeEvent = (listener) => {
			if (fail) throw Error("event acquisition failed");
			return subscribe(listener);
		};
		const core = actorCore({
			source: f.source,
			events: (e) => ({ reset: e<{ count: number }>() }),
		});
		cores.push(core);
		const a = connect(core);
		const coreObservations = f.snapshots.size;
		expect(a.connect).toThrow("event acquisition failed");
		expect(f.events.size).toBe(0);
		expect(f.snapshots.size).toBe(coreObservations);
		expect(f.source.close).not.toHaveBeenCalled();
		fail = false;
		a.connect();
		expect(f.events.size).toBe(1);
		core.dispose();
		expect(f.events.size).toBe(0);
		expect(f.snapshots.size).toBe(0);
	});
	it.each(["shared", "isolated"] as const)(
		"continues %s terminal cleanup when a native release throws, and invalidates its callback",
		(mode) => {
			const f = sourceFixture();
			f.source.subscribeEvent = (listener) => {
				f.events.add(listener);
				return () => {
					throw Error("release failed");
				};
			};
			const core =
				mode === "shared"
					? actorCore({
							source: f.source,
							events: (e) => ({ reset: e<{ count: number }>() }),
						})
					: webCore({
							source: () => f.source,
							events: (e) => ({ reset: e<{ count: number }>() }),
						});
			cores.push(core);
			const a = connect(core),
				received = vi.fn();
			a.element.addEventListener("reset", received);
			a.connect();
			f.native();
			expect(received).toHaveBeenCalledTimes(1);
			expect(() => core.dispose()).toThrow("release failed");
			expect(f.snapshots.size).toBe(0);
			f.native();
			expect(received).toHaveBeenCalledTimes(1);
			if (mode === "shared") expect(f.source.close).not.toHaveBeenCalled();
			else expect(f.source.close).toHaveBeenCalledTimes(1);
		},
	);
	it("uses the acquired isolated channel, not a headless source, and retires it on disconnect", async () => {
		const instances: ReturnType<typeof sourceFixture>[] = [];
		const core = webCore({
			source: () => {
				const f = sourceFixture();
				instances.push(f);
				return f.source;
			},
			events: (e) => ({ reset: e<{ count: number }>() }),
		});
		cores.push(core);
		const a = connect(core),
			b = connect(core),
			ra = vi.fn(),
			rb = vi.fn();
		a.element.addEventListener("reset", ra);
		b.element.addEventListener("reset", rb);
		a.connect();
		b.connect();
		expect(instances).toHaveLength(2);
		instances[0].native();
		instances[0].native();
		expect(ra).toHaveBeenCalledTimes(2);
		expect(rb).not.toHaveBeenCalled();
		a.disconnect();
		await Promise.resolve();
		expect(instances[0].events.size).toBe(0);
		expect(instances[0].source.close).toHaveBeenCalledOnce();
		a.connect();
		expect(instances).toHaveLength(3);
		expect(ra).toHaveBeenCalledTimes(2);
	});
	it("does not invent an Actor-Web event channel when it is absent", () => {
		const f = sourceFixture();
		const { subscribeEvent: _unused, ...source } = f.source;
		const core = actorCore({
			source,
			events: (e) => ({ reset: e<{ count: number }>() }),
		});
		cores.push(core);
		const a = connect(core),
			received = vi.fn();
		a.element.addEventListener("reset", received);
		a.connect();
		f.native();
		expect(received).not.toHaveBeenCalled();
		expect(f.events.size).toBe(0);
	});
});
