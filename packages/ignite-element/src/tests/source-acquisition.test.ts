import { igniteCore as actorCore } from "ignite-element/actor-web";
import { igniteCore as webCore } from "ignite-element/actor-web/web";
import { describe, expect, it, vi } from "vitest";

function sourceFixture() {
	return {
		address: "acquisition",
		snapshot: () => ({
			address: "acquisition",
			context: { count: 0 },
			phase: "active",
			toJSON: () => ({}),
		}),
		transportStatus: () => ({ state: "disconnected" as const, updatedAt: 0 }),
		subscribe: () => () => {},
		send: () => Promise.resolve(),
		close: vi.fn<() => void | Promise<void>>(),
	};
}

function expectFailure(action: () => unknown, reason: unknown) {
	let thrown = false;
	try {
		action();
	} catch (error) {
		thrown = true;
		expect(error).toBe(reason);
	}
	expect(thrown).toBe(true);
}

let nextTag = 0;
function elementFixture(core: ReturnType<typeof webCore>) {
	const tag = `source-acquisition-${nextTag++}`;
	core(tag, () => null);
	const element = document.createElement(tag);
	const cls = customElements.get(tag);
	if (!cls) throw Error("Missing registered element");
	return {
		connect: () => cls.prototype.connectedCallback.call(element),
		disconnect: () => cls.prototype.disconnectedCallback.call(element),
	};
}

describe("source-to-adapter acquisition ownership", () => {
	it.each(["snapshot", "transportStatus"] as const)(
		"closes an owned source immediately on initial %s failure and retries the same element",
		async (mode) => {
			let fail = true;
			const reason = { initial: mode };
			const sources: ReturnType<typeof sourceFixture>[] = [];
			const core = webCore({
				source: () => {
					const source = sourceFixture();
					const read = source[mode];
					Object.defineProperty(source, mode, {
						value: () => {
							if (fail) throw reason;
							return read();
						},
					});
					sources.push(source);
					return source;
				},
			});
			const element = elementFixture(core);
			expectFailure(element.connect, reason);
			expect(sources[0].close).toHaveBeenCalledOnce();
			element.disconnect();
			await Promise.resolve();
			expect(sources[0].close).toHaveBeenCalledOnce();
			fail = false;
			element.connect();
			expect(sources).toHaveLength(2);
			expect(sources[1].close).not.toHaveBeenCalled();
			element.disconnect();
			await Promise.resolve();
			expect(sources.map((source) => source.close.mock.calls.length)).toEqual([
				1, 1,
			]);
		},
	);

	it.each([
		{ reason: null, asynchronous: false },
		{ reason: undefined, asynchronous: true },
		{ reason: { setup: "failed" }, asynchronous: true },
	])(
		"preserves $reason through close rejection (async=$asynchronous)",
		async ({ reason, asynchronous }) => {
			const log = vi.spyOn(console, "error").mockImplementation(() => {});
			const cleanupError = Error("source close failed");
			const source = sourceFixture();
			const receivers: unknown[] = [];
			source.snapshot = () => {
				throw reason;
			};
			source.close.mockImplementation(function (this: unknown) {
				receivers.push(this);
				if (asynchronous) return Promise.reject(cleanupError);
				throw cleanupError;
			});
			const unhandled = vi.fn();
			process.on("unhandledRejection", unhandled);
			try {
				const element = elementFixture(webCore({ source: () => source }));
				expectFailure(element.connect, reason);
				expect(source.close).toHaveBeenCalledOnce();
				expect(receivers).toEqual([source]);
				element.disconnect();
				await new Promise((resolve) => setTimeout(resolve, 0));
				expect(source.close).toHaveBeenCalledOnce();
				expect(log).toHaveBeenCalledExactlyOnceWith(
					"[ActorWebAdapter] Failed to stop isolated source.",
					cleanupError,
				);
				expect(unhandled).not.toHaveBeenCalled();
			} finally {
				process.off("unhandledRejection", unhandled);
				log.mockRestore();
			}
		},
	);

	it("preserves a failure without optional close and allows retry", async () => {
		const { close, ...source } = sourceFixture();
		const read = source.snapshot;
		let fail = true;
		const reason = { missingClose: true };
		source.snapshot = () => {
			if (fail) throw reason;
			return read();
		};
		const element = elementFixture(webCore({ source: () => source }));
		expectFailure(element.connect, reason);
		fail = false;
		element.connect();
		element.disconnect();
		await Promise.resolve();
		expect(close).not.toHaveBeenCalled();
	});

	it("does not invent a handle when the factory throws before returning", async () => {
		const source = sourceFixture();
		let fail = true;
		const element = elementFixture(
			webCore({
				source: () => {
					if (fail) throw undefined;
					return source;
				},
			}),
		);
		expectFailure(element.connect, undefined);
		expect(source.close).not.toHaveBeenCalled();
		fail = false;
		element.connect();
		expect(source.close).not.toHaveBeenCalled();
		element.disconnect();
		await Promise.resolve();
		expect(source.close).toHaveBeenCalledOnce();
	});

	it.each(["snapshot", "transportStatus"] as const)(
		"never closes a headless factory after %s failure, retry or disposal",
		(mode) => {
			const source = sourceFixture();
			const read = source[mode];
			let fail = true;
			const reason = { headless: mode };
			Object.defineProperty(source, mode, {
				value: () => {
					if (fail) throw reason;
					return read();
				},
			});
			const core = actorCore({ source: () => source });
			expectFailure(() => core.get("states"), reason);
			expect(source.close).not.toHaveBeenCalled();
			fail = false;
			core.get("states");
			core.dispose();
			expect(source.close).not.toHaveBeenCalled();
		},
	);

	it("never closes a borrowed value when entry construction fails", () => {
		const source = sourceFixture();
		const read = source.snapshot;
		const reason = { borrowed: true };
		source.snapshot = () => {
			throw reason;
		};
		expectFailure(() => actorCore({ source }), reason);
		expect(source.close).not.toHaveBeenCalled();
		source.snapshot = read;
		const core = actorCore({ source });
		core.get("states");
		core.dispose();
		expect(source.close).not.toHaveBeenCalled();
	});
});
