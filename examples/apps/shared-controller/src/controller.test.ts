import { describe, expect, it } from "vitest";
import { createController } from "./controller.js";
import { createFakePorts } from "./fake-ports.js";
import { observe } from "./headless.js";
import { at, fixture } from "./test-fixture.js";

describe("one plain controller, deterministic ports", () => {
	it("loads initially, guards invalid/pending intents, and confirms only a matching receipt", async () => {
		const f = fixture();
		expect(f.state().canChoose).toBe(false);
		await f.owner.source.send({ type: "choose", density: "compact" });
		expect(f.fake.writes).toHaveLength(0);
		await f.load();
		expect(f.state().confirmed).toBe("comfortable");
		await Reflect.apply(f.owner.source.send, null, [
			{ type: "choose", density: "invalid" },
		]);
		expect(f.fake.writes).toHaveLength(0);
		const write = f.owner.core.execute({ command: "choose", input: "compact" });
		expect(f.state()).toMatchObject({
			outcome: "pending",
			confirmed: "comfortable",
			canChoose: false,
		});
		await f.owner.source.send({ type: "choose", density: "comfortable" });
		expect(f.fake.writes).toHaveLength(1);
		const request = at(f.fake.writes, 0);
		request.result.resolve({ kind: "accepted", ...request.request });
		expect((await write).states).toMatchObject({
			outcome: "confirmed",
			confirmed: "compact",
		});
		f.owner.dispose();
	});
	it("retries rejection but not uncertainty; deadline leaves the write alive for a late receipt", async () => {
		const f = fixture();
		await f.load();
		let pending = f.owner.core.execute({ command: "choose", input: "compact" });
		at(f.fake.writes, 0).result.resolve({ kind: "rejected" });
		await pending;
		expect(f.state()).toMatchObject({
			outcome: "rejected",
			confirmed: "comfortable",
			canRetry: true,
		});
		pending = f.owner.core.execute({ command: "retry" });
		f.fake.advance(5000);
		expect(f.state()).toMatchObject({
			outcome: "unknown",
			confirmed: "comfortable",
			canRetry: false,
			canChoose: false,
		});
		await f.owner.core.execute({ command: "retry" });
		expect(f.fake.writes).toHaveLength(2);
		const write = at(f.fake.writes, 1);
		write.result.resolve({ kind: "accepted", ...write.request });
		await pending;
		expect(f.state()).toMatchObject({
			outcome: "confirmed",
			confirmed: "compact",
		});
		f.owner.dispose();
	});
	it("rejects stale reads and mismatched receipts, and a query does not settle an unknown write", async () => {
		const f = fixture();
		await f.load();
		const stale = f.owner.core.execute({ command: "check" });
		const pending = f.owner.core.execute({
			command: "choose",
			input: "compact",
		});
		const write = at(f.fake.writes, 0);
		write.result.resolve({ kind: "accepted", ...write.request });
		await pending;
		at(f.fake.reads, 1).resolve({
			kind: "value",
			account: "demo",
			density: "comfortable",
		});
		await stale;
		expect(f.state().confirmed).toBe("compact");
		const mismatch = f.owner.core.execute({
			command: "choose",
			input: "comfortable",
		});
		const second = at(f.fake.writes, 1);
		second.result.resolve({
			kind: "accepted",
			...second.request,
			epoch: "old-login",
		});
		await mismatch;
		expect(f.state().outcome).toBe("unknown");
		await f.load();
		expect(f.state()).toMatchObject({
			confirmed: "comfortable",
			outcome: "unknown",
			canChoose: false,
		});
		f.owner.dispose();
	});
	it("reports transport failures and keeps the last confirmation; failed reads remain unavailable", async () => {
		const f = fixture();
		let read = f.owner.core.execute({ command: "check" });
		at(f.fake.reads, 0).reject(new Error("offline"));
		await read;
		expect(f.state().message).toContain("Could not load");
		expect(f.fake.errors).toHaveLength(1);
		await f.load();
		const pending = f.owner.core.execute({
			command: "choose",
			input: "compact",
		});
		at(f.fake.writes, 0).result.reject(new Error("lost response"));
		await pending;
		expect(f.state()).toMatchObject({
			confirmed: "comfortable",
			outcome: "unknown",
		});
		expect(f.fake.errors).toHaveLength(2);
		read = f.owner.core.execute({ command: "check" });
		at(f.fake.reads, 2).resolve({
			kind: "value",
			account: "another-account",
			density: "compact",
		});
		await read;
		expect(f.state().confirmed).toBe("comfortable");
		f.owner.dispose();
	});
	it.each(["demo", "different"])(
		"protects a replacement owner for account %s, including same-account login",
		async (account) => {
			const old = fixture();
			await old.load();
			const replacement = fixture(account, "login-2");
			await replacement.load();
			let settled = false;
			const result = old.owner.core
				.execute({ command: "choose", input: "compact" })
				.then(
					() => {
						throw new Error("Disposed execute unexpectedly fulfilled");
					},
					(error) => {
						settled = true;
						return error;
					},
				);
			old.owner.dispose();
			old.owner.dispose();
			await Promise.resolve();
			expect(settled).toBe(false);
			const write = at(old.fake.writes, 0);
			write.result.resolve({ kind: "accepted", ...write.request });
			expect(await result).toMatchObject({
				message: expect.stringMatching(/disposed/),
			});
			expect(replacement.state().confirmed).toBe("comfortable");
			expect(old.owner.observationCount()).toBe(0);
			replacement.owner.dispose();
		},
	);
	it("invalidates retained native controller methods and drops a late read after disposal", async () => {
		const fake = createFakePorts();
		const c = createController({ account: "demo", epoch: "one" }, fake.ports);
		const read = c.check();
		c.dispose();
		at(fake.reads, 0).resolve({
			kind: "value",
			account: "demo",
			density: "compact",
		});
		await read;
		await c.choose("comfortable");
		expect(c.snapshot().confirmed).toBe(null);
		expect(fake.writes).toHaveLength(0);
	});
	it("subscribes before its initial render, cleans up a failed render and does not dispose the owner", async () => {
		const f = fixture();
		expect(() =>
			observe(f.owner.core, () => {
				throw new Error("render");
			}),
		).toThrow("render");
		const seen: string[] = [];
		const stop = observe(f.owner.core, (s) => seen.push(s.outcome));
		await f.load();
		expect(seen.length).toBeGreaterThan(1);
		stop();
		expect(f.owner.observationCount()).toBe(1);
		f.owner.dispose();
	});
});
