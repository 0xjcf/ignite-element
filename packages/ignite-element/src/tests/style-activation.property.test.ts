import fc from "fast-check";
import { afterEach, expect, it, vi } from "vitest";

const slot = Symbol.for("ignite-element.style-inject");
const properties = { seed: 1802030, numRuns: 60 };

afterEach(() => {
	document.body.replaceChildren();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

async function freshHooks() {
	vi.resetModules();
	Reflect.deleteProperty(globalThis, slot);
	return import("../../../ignite-renderer/src/styleHook");
}

function root(connected: boolean) {
	const host = document.createElement("div");
	if (connected) document.body.append(host);
	return host.attachShadow({ mode: "open" });
}

it("reading renderer configuration does not activate stylesheet delivery", async () => {
	await freshHooks();
	const { getIgniteConfig } = await import("@ignite-element/renderer");
	getIgniteConfig();
	expect(Reflect.get(globalThis, slot)).toBeUndefined();
});

it("keeps queued roots pending until explicit flush and never revives cancelled roots", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.boolean(),
			fc.boolean(),
			async (connected, cancelled) => {
				const hooks = await freshHooks();
				const shadow = root(connected);
				hooks.injectStyles(shadow);
				if (cancelled) hooks.forgetQueuedStyles(shadow);
				const { setGlobalStyles } = await import("../globalStyles");
				const { flushPendingStyles } = await import("../injectStyles");
				setGlobalStyles("./workout.css");
				expect(shadow.querySelectorAll("link")).toHaveLength(0);
				flushPendingStyles();
				flushPendingStyles();
				expect(shadow.querySelectorAll("link")).toHaveLength(cancelled ? 0 : 1);
				hooks.forgetQueuedStyles(shadow);
				shadow.host.remove();
			},
		),
		properties,
	);
});

it("replays parked styles on reconnect without clearing terminal detach", async () => {
	await fc.assert(
		fc.asyncProperty(fc.boolean(), async (cancelled) => {
			const hooks = await freshHooks();
			const shadow = root(true);
			hooks.injectStyles(shadow);
			shadow.host.remove();
			const { setGlobalStyles } = await import("../globalStyles");
			const { flushPendingStyles } = await import("../injectStyles");
			const { replayParkedStyles } = await import("../injectStyles");
			setGlobalStyles("./workout.css");
			flushPendingStyles();
			expect(shadow.querySelectorAll("link")).toHaveLength(0);
			if (cancelled) hooks.forgetQueuedStyles(shadow);
			document.body.append(shadow.host);
			// Invoke the same signal used by the element's connectedCallback.
			replayParkedStyles(shadow);
			replayParkedStyles(shadow);
			expect(shadow.querySelectorAll("link")).toHaveLength(cancelled ? 0 : 1);
			hooks.forgetQueuedStyles(shadow);
			shadow.host.remove();
		}),
		properties,
	);
});

it("retains connection history before driver activation and applies the latest style on reconnect", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.integer({ min: 1, max: 5 }),
			fc.constantFrom("none", "before", "after"),
			async (moves, cancellation) => {
				const hooks = await freshHooks();
				const shadow = root(false);
				const neverConnected = root(false);
				const { replayParkedStyles, flushPendingStyles } = await import(
					"../injectStyles"
				);
				const { setGlobalStyles } = await import("../globalStyles");
				hooks.injectStyles(shadow);
				hooks.injectStyles(neverConnected);
				for (let index = 0; index < moves; index++) {
					document.body.append(shadow.host);
					replayParkedStyles(shadow);
					shadow.host.remove();
				}
				if (cancellation === "before") hooks.forgetQueuedStyles(shadow);
				setGlobalStyles("./first.css");
				flushPendingStyles();
				expect(shadow.querySelectorAll("link")).toHaveLength(0);
				// Recording one root's connection must not park an unrelated root.
				expect(neverConnected.querySelectorAll("link")).toHaveLength(1);
				if (cancellation === "after") hooks.forgetQueuedStyles(shadow);
				setGlobalStyles("./latest.css");
				document.body.append(shadow.host);
				replayParkedStyles(shadow);
				expect(shadow.querySelectorAll("link")).toHaveLength(
					cancellation === "none" ? 1 : 0,
				);
				if (cancellation === "none")
					expect(shadow.querySelector("link")?.getAttribute("href")).toBe(
						"./latest.css",
					);
				hooks.forgetQueuedStyles(shadow);
				hooks.forgetQueuedStyles(neverConnected);
				shadow.host.remove();
			},
		),
		properties,
	);
});

it("does not retain a detached element while waiting for the style driver", async () => {
	const hooks = await freshHooks();
	const globals = globalThis as typeof globalThis & {
		WeakRef: new <T extends object>(value: T) => { deref(): T | undefined };
		gc: () => void;
	};
	const probe = (() => {
		const shadow = root(true);
		hooks.injectStyles(shadow);
		shadow.host.remove();
		return new globals.WeakRef(shadow.host);
	})();
	await new Promise((resolve) => setTimeout(resolve, 0));
	globals.gc();
	globals.gc();
	expect(probe.deref()).toBeUndefined();
	const inject = vi.fn();
	hooks.installStyleInject(inject);
	expect(inject).not.toHaveBeenCalled();
});

it("signals reconnect only to an installed replay callback", async () => {
	const hooks = await freshHooks();
	const { replayParkedStyles } = await import("../injectStyles");
	const shadow = root(true);
	replayParkedStyles(shadow);
	expect(Reflect.get(globalThis, slot)).toBeUndefined();
	hooks.injectStyles(shadow);
	const queued = Reflect.get(globalThis, slot);
	replayParkedStyles(shadow);
	expect(Reflect.get(globalThis, slot)).toBe(queued);
	const inject = vi.fn();
	hooks.installStyleInject(inject);
	inject.mockClear();
	replayParkedStyles(shadow);
	expect(inject).not.toHaveBeenCalled();
	const replay = vi.fn();
	hooks.installStyleInject(inject, replay);
	// Legacy reinstallation must retain the driver's reconnect callback.
	hooks.installStyleInject(inject);
	replayParkedStyles(shadow);
	expect(replay).toHaveBeenCalledExactlyOnceWith(shadow);
});

it("cancelling before the first style request is harmless", async () => {
	const hooks = await freshHooks();
	const shadow = root(false);
	expect(() => hooks.forgetQueuedStyles(shadow)).not.toThrow();
	expect(Reflect.get(globalThis, slot)).toBeUndefined();
});

it("delivers an uncancelled request without WeakRef", async () => {
	vi.stubGlobal("WeakRef", undefined);
	const hooks = await freshHooks();
	vi.unstubAllGlobals();
	const shadow = root(true);
	hooks.injectStyles(shadow);
	const inject = vi.fn();
	hooks.installStyleInject(inject);
	expect(inject).toHaveBeenCalledExactlyOnceWith(shadow, true);
});

it("releases every cancelled queue entry when WeakRef is unavailable", async () => {
	const globals = globalThis as typeof globalThis & {
		WeakRef: new <T extends object>(value: T) => { deref(): T | undefined };
		gc: () => void;
	};
	const Ref = globals.WeakRef;
	vi.stubGlobal("WeakRef", undefined);
	const hooks = await freshHooks();
	vi.unstubAllGlobals();
	const probe = (() => {
		const shadow = root(false);
		hooks.injectStyles(shadow);
		hooks.injectStyles(shadow);
		hooks.forgetQueuedStyles(shadow);
		return new Ref(shadow.host);
	})();
	await new Promise((resolve) => setTimeout(resolve, 0));
	globals.gc();
	expect(probe.deref()).toBeUndefined();
	const inject = vi.fn();
	hooks.installStyleInject(inject);
	expect(inject).not.toHaveBeenCalled();
});

it("drops all cancelled requests from the pre-driver queue", async () => {
	await fc.assert(
		fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (repeats) => {
			const hooks = await freshHooks();
			const kept = root(true);
			const cancelled = root(false);
			for (let index = 0; index < repeats; index++) {
				hooks.injectStyles(cancelled);
				hooks.injectStyles(kept);
			}
			hooks.forgetQueuedStyles(cancelled);
			const inject = vi.fn();
			hooks.installStyleInject(inject);
			expect(inject).toHaveBeenCalledTimes(repeats);
			for (const args of inject.mock.calls) expect(args).toEqual([kept, true]);
		}),
		properties,
	);
});

it("does not inject rejected stylesheet paths after deferred activation", async () => {
	vi.spyOn(console, "warn").mockImplementation(() => {});
	await fc.assert(
		fc.asyncProperty(
			fc.constantFrom(
				"javascript:alert(1)",
				"./workout.scss",
				"data:text/css,body{}",
				"invalid",
			),
			async (path) => {
				const hooks = await freshHooks();
				const shadow = root(true);
				hooks.injectStyles(shadow);
				const { setGlobalStyles } = await import("../globalStyles");
				const { flushPendingStyles } = await import("../injectStyles");
				setGlobalStyles(path);
				flushPendingStyles();
				expect(shadow.querySelectorAll("link,style")).toHaveLength(0);
				hooks.forgetQueuedStyles(shadow);
				shadow.host.remove();
			},
		),
		properties,
	);
});
