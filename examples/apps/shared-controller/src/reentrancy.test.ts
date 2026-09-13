import { expect, test } from "vitest";
import { createFakePorts } from "./fake-ports.js";
import { createOwner } from "./owner.js";
import { at } from "./test-fixture.js";

function fixture() {
	const fake = createFakePorts();
	const timers = new Set<object>();
	const owner = createOwner(
		{ account: "demo", epoch: "one" },
		{
			...fake.ports,
			after(ms, callback) {
				const token = {};
				timers.add(token);
				const cancel = fake.ports.after(ms, () => {
					timers.delete(token);
					callback();
				});
				return () => {
					timers.delete(token);
					cancel();
				};
			},
		},
	);
	async function load() {
		const read = owner.core.execute({ command: "check" });
		at(fake.reads, 0).resolve({
			kind: "value",
			account: "demo",
			density: "comfortable",
		});
		await read;
	}
	function accept(index: number) {
		const write = at(fake.writes, index);
		write.result.resolve({ kind: "accepted", ...write.request });
	}
	return { fake, timers, owner, load, accept };
}

test("ordinary completion releases its deadline", async () => {
	const f = fixture();
	await f.load();
	const write = f.owner.core.execute({ command: "choose", input: "compact" });
	expect(f.timers.size).toBe(1);
	f.accept(0);
	await write;
	expect(f.timers.size).toBe(0);
	expect(f.owner.core.get("states").confirmed).toBe("compact");
	f.owner.dispose();
	expect(f.owner.observationCount()).toBe(0);
});

test("pending observer disposal prevents subsequent write and deadline acquisition", async () => {
	const f = fixture();
	await f.load();
	f.owner.core.watch((state) => {
		if (state.outcome === "pending") f.owner.dispose();
	});
	const command = f.owner.core
		.execute({ command: "choose", input: "compact" })
		.then(
			() => null,
			(error: unknown) => error,
		);
	const initial = {
		disposed: f.owner.isDisposed(),
		writes: f.fake.writes.length,
		timers: f.timers.size,
	};
	for (let i = 0; i < f.fake.writes.length; i++) f.accept(i);
	const error = await command;
	const settled = f.timers.size;
	f.owner.dispose();
	const actual = { ...initial, settled, repeated: f.timers.size };
	console.log("SC-1 pending-disposal", actual);
	f.fake.advance(5000);
	expect(error).toBeInstanceOf(Error);
	expect(String(error)).toContain("disposed");
	expect(actual).toEqual({
		disposed: true,
		writes: 0,
		timers: 0,
		settled: 0,
		repeated: 0,
	});
});

test("loading observer disposal prevents subsequent read acquisition", async () => {
	const f = fixture();
	f.owner.core.watch((state) => {
		if (!state.canCheck) f.owner.dispose();
	});
	const command = f.owner.core.execute({ command: "check" }).then(
		() => null,
		(error: unknown) => error,
	);
	const actual = { disposed: f.owner.isDisposed(), reads: f.fake.reads.length };
	for (const read of f.fake.reads) read.resolve({ kind: "unavailable" });
	const error = await command;
	console.log("SC-1 loading-disposal", actual);
	expect(error).toBeInstanceOf(Error);
	expect(String(error)).toContain("disposed");
	expect(actual).toEqual({ disposed: true, reads: 0 });
});

for (const outcome of ["confirmed", "rejected"] as const) {
	test(`a next write from ${outcome} delivery owns only its own deadline`, async () => {
		const f = fixture();
		await f.load();
		let started = false;
		let second: Promise<unknown> | undefined;
		f.owner.core.watch((state) => {
			if (state.outcome === outcome && !started) {
				started = true;
				second =
					outcome === "confirmed"
						? f.owner.core.execute({ command: "choose", input: "comfortable" })
						: f.owner.core.execute({ command: "retry" });
			}
		});
		const first = f.owner.core.execute({ command: "choose", input: "compact" });
		if (outcome === "confirmed") f.accept(0);
		else at(f.fake.writes, 0).result.resolve({ kind: "rejected" });
		await first;
		const writes = f.fake.writes.length,
			afterFirst = f.timers.size;
		if (f.fake.writes[1]) f.accept(1);
		await second;
		const afterSecond = f.timers.size;
		f.owner.dispose();
		const actual = {
			writes,
			afterFirst,
			afterSecond,
			afterDisposal: f.timers.size,
		};
		console.log(`SC-1 reentrant-${outcome}`, actual);
		f.fake.advance(5000);
		expect(started).toBe(true);
		expect(second).toBeDefined();
		expect(actual).toEqual({
			writes: 2,
			afterFirst: 1,
			afterSecond: 0,
			afterDisposal: 0,
		});
	});
}

test("a query started during confirmation stays loading and can apply its fresh result", async () => {
	const f = fixture();
	await f.load();
	let started = false;
	let refresh: Promise<unknown> | undefined;
	f.owner.core.watch((state) => {
		if (state.outcome === "confirmed" && !started) {
			started = true;
			refresh = f.owner.core.execute({ command: "check" });
		}
	});
	const write = f.owner.core.execute({ command: "choose", input: "compact" });
	f.accept(0);
	await write;
	const reads = f.fake.reads.length;
	const loading = !f.owner.core.get("states").canCheck;
	at(f.fake.reads, 1).resolve({
		kind: "value",
		account: "demo",
		density: "comfortable",
	});
	await refresh;
	const actual = {
		reads,
		loading,
		confirmed: f.owner.core.get("states").confirmed,
	};
	f.owner.dispose();
	console.log("SC-1 reentrant-refresh", actual);
	expect(actual).toEqual({ reads: 2, loading: true, confirmed: "comfortable" });
});

test("a write started during loading delivery prevents the superseded read acquisition", async () => {
	const f = fixture();
	await f.load();
	let started = false;
	let write: Promise<unknown> | undefined;
	f.owner.core.watch((state) => {
		if (!state.canCheck && !started) {
			started = true;
			write = f.owner.core.execute({ command: "choose", input: "compact" });
		}
	});
	await f.owner.core.execute({ command: "check" });
	expect(f.fake.reads).toHaveLength(1);
	expect(f.fake.writes).toHaveLength(1);
	f.accept(0);
	await write;
	expect(f.owner.core.get("states").confirmed).toBe("compact");
	expect(f.timers.size).toBe(0);
	f.owner.dispose();
});

test("read completion can start a fresh query without an old finalizer clearing it", async () => {
	const f = fixture();
	let started = false;
	let refresh: Promise<unknown> | undefined;
	f.owner.core.watch((state) => {
		if (state.canCheck && state.confirmed === "comfortable" && !started) {
			started = true;
			refresh = f.owner.core.execute({ command: "check" });
		}
	});
	await f.load();
	expect(f.fake.reads).toHaveLength(2);
	expect(f.owner.core.get("states").canCheck).toBe(false);
	at(f.fake.reads, 1).resolve({
		kind: "value",
		account: "demo",
		density: "compact",
	});
	await refresh;
	expect(f.owner.core.get("states").confirmed).toBe("compact");
	expect(f.owner.core.get("states").canCheck).toBe(true);
	f.owner.dispose();
});

test("disposing a pending reentrant write releases its own deadline before transport settles", async () => {
	const f = fixture();
	await f.load();
	let started = false;
	let second: Promise<unknown> | undefined;
	f.owner.core.watch((state) => {
		if (state.outcome === "confirmed" && !started) {
			started = true;
			second = f.owner.core
				.execute({ command: "choose", input: "comfortable" })
				.then(
					() => null,
					(error: unknown) => error,
				);
		}
	});
	const first = f.owner.core.execute({ command: "choose", input: "compact" });
	f.accept(0);
	await first;
	expect(f.timers.size).toBe(1);
	f.owner.dispose();
	expect(f.timers.size).toBe(0);
	f.accept(1);
	expect(String(await second)).toContain("disposed");
	f.owner.dispose();
	expect(f.timers.size).toBe(0);
});

test("synchronous deadline delivery rechecks disposal before starting transport", async () => {
	const f = fixture();
	await f.load();
	const schedule = f.fake.ports.after;
	f.fake.ports.after = (ms, callback) => {
		const cancel = schedule(ms, callback);
		f.fake.advance(ms);
		return cancel;
	};
	f.owner.core.watch((state) => {
		if (state.outcome === "unknown") f.owner.dispose();
	});
	await expect(
		f.owner.core.execute({ command: "choose", input: "compact" }),
	).rejects.toThrow("disposed");
	expect(f.fake.writes).toHaveLength(0);
	expect(f.timers.size).toBe(0);
	f.owner.dispose();
});
