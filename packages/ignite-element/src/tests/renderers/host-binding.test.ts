import { afterEach, describe, expect, it, vi } from "vitest";
import type { Host, HostContext } from "../../hosts/types";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import {
	describeIgniteHosts,
	renderIgniteJsx,
} from "../../renderers/jsx/renderer";

type Scene = { angle: number };
type Handle = { id: number };

function sceneHost(hooks?: {
	mount?: Host<HTMLCanvasElement, Scene, Handle, number>["mount"];
	update?: Host<HTMLCanvasElement, Scene, Handle, number>["update"];
	dispose?: Host<HTMLCanvasElement, Scene, Handle, number>["dispose"];
}): Host<HTMLCanvasElement, Scene, Handle, number> & {
	mounts: number;
	updates: Scene[];
	disposed: Handle[];
	contexts: HostContext[];
} {
	const record = {
		mounts: 0,
		updates: [] as Scene[],
		disposed: [] as Handle[],
		contexts: [] as HostContext[],
	};
	const host: Host<HTMLCanvasElement, Scene, Handle, number> = {
		mount(el, ctx) {
			record.mounts += 1;
			record.contexts.push(ctx);
			if (hooks?.mount) return hooks.mount(el, ctx);
			const child = document.createElement("span");
			child.dataset.engine = "scene";
			el.append(child);
			return { id: record.mounts };
		},
		update(handle, slice) {
			record.updates.push(slice);
			hooks?.update?.(handle, slice);
		},
		dispose(handle) {
			record.disposed.push(handle);
			hooks?.dispose?.(handle);
		},
		select: (angle) => ({ angle }),
		equals: (a, b) => a.angle === b.angle,
		describe: (slice) => `angle ${slice.angle}`,
	};
	return Object.assign(record, host);
}

function runtime(
	host: ReturnType<typeof sceneHost>,
	snapshot: number,
	extras?: { server?: boolean; send?: (event: unknown) => void },
) {
	return {
		server: extras?.server,
		snapshot,
		send: extras?.send ?? (() => undefined),
		reducedMotion: () => false,
		hosts: { scene: host },
	};
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
});

describe("host binding", () => {
	it("describes a snapshot without an element and without mounting", () => {
		const host = sceneHost();
		expect(describeIgniteHosts({ scene: host }, 4)).toEqual({
			scene: "angle 4",
		});
		expect(host.mounts).toBe(0);
	});

	it("does not mount during a server render, and still exposes describe text", () => {
		const host = sceneHost();
		const root = document.createElement("div");
		renderIgniteJsx(root, jsx("canvas", { use: "scene" }), undefined, {
			hosts: runtime(host, 3, { server: true }),
		});
		const canvas = root.querySelector("canvas");
		expect(canvas?.getAttribute("aria-description")).toBe("angle 3");
		expect(canvas?.hasAttribute("use")).toBe(false);
		expect(host.mounts).toBe(0);
		expect(canvas?.querySelector("[data-engine]")).toBeNull();
	});

	it("mounts on the client, skips unchanged slices, and keeps an owned subtree", () => {
		const host = sceneHost();
		const root = document.createElement("div");
		document.body.append(root);
		let tree = renderIgniteJsx(
			root,
			jsx("div", {
				children: [
					jsx("canvas", { use: "scene", "aria-label": "Orbit" }),
					jsx("p", { children: "first" }),
				],
			}),
			undefined,
			{ hosts: runtime(host, 1) },
		);
		const canvas = root.querySelector("canvas");
		expect(canvas?.getAttribute("aria-description")).toBe("angle 1");
		expect(canvas?.getAttribute("aria-label")).toBe("Orbit");
		expect(canvas?.hasAttribute("use")).toBe(false);
		expect(host.mounts).toBe(1);
		expect(host.updates).toEqual([{ angle: 1 }]);
		expect(canvas?.querySelector("[data-engine='scene']")).not.toBeNull();

		tree = renderIgniteJsx(
			root,
			jsx("div", {
				children: [
					jsx("canvas", { use: "scene", "aria-label": "Orbit" }),
					jsx("p", { children: "second" }),
				],
			}),
			tree,
			{ hosts: runtime(host, 1) },
		);
		expect(host.mounts).toBe(1);
		expect(host.updates).toEqual([{ angle: 1 }]);
		expect(root.querySelector("canvas")).toBe(canvas);
		expect(canvas?.querySelector("[data-engine='scene']")).not.toBeNull();
		expect(root.querySelector("p")?.textContent).toBe("second");

		renderIgniteJsx(
			root,
			jsx("div", {
				children: jsx("canvas", { use: "scene" }),
			}),
			tree,
			{ hosts: runtime(host, 2) },
		);
		expect(host.updates).toEqual([{ angle: 1 }, { angle: 2 }]);
		expect(canvas?.getAttribute("aria-description")).toBe("angle 2");
	});

	it("keeps the host instance across a keyed move", () => {
		const host = sceneHost();
		const root = document.createElement("div");
		const list = (order: string[]) =>
			jsx("div", {
				children: order.map((key) =>
					key === "scene"
						? jsx("canvas", { use: "scene" }, "scene")
						: jsx("span", { children: key }, key),
				),
			});
		let tree = renderIgniteJsx(root, list(["scene", "caption"]), undefined, {
			hosts: runtime(host, 1),
		});
		const canvas = root.querySelector("canvas");
		tree = renderIgniteJsx(root, list(["caption", "scene"]), tree, {
			hosts: runtime(host, 1),
		});
		expect(root.querySelector("canvas")).toBe(canvas);
		expect(host.mounts).toBe(1);
		expect(host.disposed).toEqual([]);
		expect(canvas?.querySelector("[data-engine='scene']")).not.toBeNull();
	});

	it("queues the latest slice until an async mount resolves", async () => {
		let resolveMount: (handle: Handle) => void = () => undefined;
		const host = sceneHost({
			mount: () =>
				new Promise((resolve) => {
					resolveMount = resolve;
				}),
		});
		const root = document.createElement("div");
		let tree = renderIgniteJsx(
			root,
			jsx("canvas", { use: "scene" }),
			undefined,
			{
				hosts: runtime(host, 1),
			},
		);
		tree = renderIgniteJsx(root, jsx("canvas", { use: "scene" }), tree, {
			hosts: runtime(host, 5),
		});
		expect(host.updates).toEqual([]);
		resolveMount({ id: 7 });
		await Promise.resolve();
		expect(host.updates).toEqual([{ angle: 5 }]);
		expect(host.disposed).toEqual([]);
	});

	it("aborts an in-flight mount and disposes only after it resolves", async () => {
		let resolveMount: (handle: Handle) => void = () => undefined;
		const host = sceneHost({
			mount: (_el, ctx) =>
				new Promise((resolve) => {
					expect(ctx.signal.aborted).toBe(false);
					resolveMount = resolve;
				}),
		});
		const root = document.createElement("div");
		const tree = renderIgniteJsx(
			root,
			jsx("canvas", { use: "scene" }),
			undefined,
			{ hosts: runtime(host, 1) },
		);
		renderIgniteJsx(root, null, tree, { hosts: runtime(host, 1) });
		expect(host.contexts[0]?.signal.aborted).toBe(true);
		expect(host.disposed).toEqual([]);
		const handle = { id: 9 };
		resolveMount(handle);
		await Promise.resolve();
		expect(host.disposed).toEqual([handle]);
		expect(host.updates).toEqual([]);
	});

	it("disposes a settled host when the element unmounts", () => {
		const host = sceneHost();
		const root = document.createElement("div");
		const tree = renderIgniteJsx(
			root,
			jsx("canvas", { use: "scene" }),
			undefined,
			{ hosts: runtime(host, 1) },
		);
		renderIgniteJsx(root, null, tree, { hosts: runtime(host, 1) });
		expect(host.disposed).toEqual([{ id: 1 }]);
	});

	it("forwards engine input through ctx.send and reads reducedMotion live", () => {
		let matches = false;
		const listeners = new Set<() => void>();
		vi.stubGlobal("matchMedia", (query: string) => {
			expect(query).toBe("(prefers-reduced-motion: reduce)");
			return {
				matches,
				addEventListener: (_name: string, listener: () => void) => {
					listeners.add(listener);
				},
				removeEventListener: (_name: string, listener: () => void) => {
					listeners.delete(listener);
				},
			};
		});
		const sent: unknown[] = [];
		const host = sceneHost();
		const root = document.createElement("div");
		const tree = renderIgniteJsx(
			root,
			jsx("canvas", { use: "scene" }),
			undefined,
			{
				hosts: {
					...runtime(host, 1, { send: (event) => sent.push(event) }),
					reducedMotion: () => matches,
				},
			},
		);
		const ctx = host.contexts[0];
		expect(ctx?.reducedMotion).toBe(false);
		ctx?.send({ type: "PING" });
		expect(sent).toEqual([{ type: "PING" }]);
		matches = true;
		expect(ctx?.reducedMotion).toBe(true);
		for (const listener of listeners) listener();
		expect(host.updates).toEqual([{ angle: 1 }, { angle: 1 }]);
		renderIgniteJsx(root, null, tree, {
			hosts: runtime(host, 1, { send: (event) => sent.push(event) }),
		});
		expect(listeners.size).toBe(0);
	});

	it("warns on an unknown host and does not mount", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const host = sceneHost();
		const root = document.createElement("div");
		let tree = renderIgniteJsx(
			root,
			jsx("canvas", { use: "missing" }),
			undefined,
			{
				hosts: runtime(host, 1),
			},
		);
		tree = renderIgniteJsx(root, jsx("canvas", { use: "missing" }), tree, {
			hosts: runtime(host, 1),
		});
		expect(host.mounts).toBe(0);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('Unknown host "missing"'),
		);
	});

	it("stays quiet about an unknown host in production", () => {
		vi.stubEnv("NODE_ENV", "production");
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const root = document.createElement("div");
		renderIgniteJsx(root, jsx("canvas", { use: "missing" }), undefined, {
			hosts: runtime(sceneHost(), 1),
		});
		expect(warn).not.toHaveBeenCalled();
	});

	it("uses Object.is when equals is omitted, and skips a host with no describe", () => {
		const updates: number[] = [];
		const host: Host<HTMLCanvasElement, number, number, number> = {
			mount: () => 1,
			update: (_handle, slice) => {
				updates.push(slice);
			},
			dispose: () => undefined,
			select: (snapshot) => snapshot,
		};
		const root = document.createElement("div");
		let tree = renderIgniteJsx(
			root,
			jsx("canvas", { use: "scene" }),
			undefined,
			{
				hosts: { ...runtime(sceneHost(), 1), hosts: { scene: host } },
			},
		);
		tree = renderIgniteJsx(root, jsx("canvas", { use: "scene" }), tree, {
			hosts: { ...runtime(sceneHost(), 1), hosts: { scene: host } },
		});
		tree = renderIgniteJsx(root, jsx("canvas", { use: "scene" }), tree, {
			hosts: { ...runtime(sceneHost(), 4), hosts: { scene: host } },
		});
		expect(updates).toEqual([1, 4]);
		expect(root.querySelector("canvas")?.hasAttribute("aria-description")).toBe(
			false,
		);
		expect(describeIgniteHosts({ scene: host }, 4)).toEqual({});
	});

	it("disposes the previous host once when use changes or clears", () => {
		const first = sceneHost();
		const second = sceneHost();
		const root = document.createElement("div");
		const hostsFor = (snapshot: number) => ({
			...runtime(first, snapshot),
			hosts: { scene: first, other: second },
		});
		let tree = renderIgniteJsx(
			root,
			jsx("canvas", { use: "scene" }),
			undefined,
			{ hosts: hostsFor(1) },
		);
		tree = renderIgniteJsx(root, jsx("canvas", { use: "other" }), tree, {
			hosts: hostsFor(2),
		});
		expect(first.disposed).toEqual([{ id: 1 }]);
		expect(second.mounts).toBe(1);
		tree = renderIgniteJsx(root, jsx("canvas", {}), tree, {
			hosts: hostsFor(2),
		});
		expect(second.disposed).toEqual([{ id: 1 }]);
		renderIgniteJsx(root, null, tree, { hosts: hostsFor(2) });
		expect(first.disposed).toEqual([{ id: 1 }]);
		expect(second.disposed).toEqual([{ id: 1 }]);
	});

	it("logs host failures and keeps rendering the rest of the view", async () => {
		const error = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const root = document.createElement("div");
		const broken = sceneHost({
			mount() {
				throw new Error("mount failed");
			},
		});
		renderIgniteJsx(
			root,
			jsx("div", {
				children: [
					jsx("canvas", { use: "scene" }),
					jsx("p", { children: "kept" }),
				],
			}),
			undefined,
			{ hosts: { ...runtime(broken, 1), hosts: { scene: broken } } },
		);
		expect(root.querySelector("p")?.textContent).toBe("kept");
		expect(broken.disposed).toEqual([]);

		const updating = sceneHost({
			update() {
				throw new Error("update failed");
			},
		});
		updating.describe = () => {
			throw new Error("describe failed");
		};
		let tree = renderIgniteJsx(
			root,
			jsx("canvas", { use: "scene" }),
			undefined,
			{ hosts: { ...runtime(updating, 1), hosts: { scene: updating } } },
		);
		tree = renderIgniteJsx(root, jsx("canvas", { use: "scene" }), tree, {
			hosts: { ...runtime(updating, 2), hosts: { scene: updating } },
		});
		expect(root.querySelector("canvas")).not.toBeNull();

		const disposing = sceneHost({
			dispose() {
				throw new Error("dispose failed");
			},
		});
		tree = renderIgniteJsx(root, jsx("canvas", { use: "scene" }), undefined, {
			hosts: { ...runtime(disposing, 1), hosts: { scene: disposing } },
		});
		expect(() =>
			renderIgniteJsx(root, null, tree, {
				hosts: { ...runtime(disposing, 1), hosts: { scene: disposing } },
			}),
		).not.toThrow();

		let rejectMount: (error: Error) => void = () => undefined;
		const pending = sceneHost({
			mount: () =>
				new Promise((_resolve, reject) => {
					rejectMount = reject;
				}),
		});
		renderIgniteJsx(root, jsx("canvas", { use: "scene" }), undefined, {
			hosts: { ...runtime(pending, 1), hosts: { scene: pending } },
		});
		rejectMount(new Error("mount rejected"));
		await Promise.resolve();

		const messages = error.mock.calls.map((call) => String(call[0]));
		expect(messages).toEqual(
			expect.arrayContaining([
				expect.stringContaining("Host mount failed."),
				expect.stringContaining("Host update failed."),
				expect.stringContaining("Host describe failed."),
				expect.stringContaining("Host dispose failed."),
			]),
		);
	});

	it("still mounts when reduced-motion queries are missing", () => {
		vi.stubGlobal("matchMedia", undefined);
		const host = sceneHost();
		const root = document.createElement("div");
		renderIgniteJsx(root, jsx("canvas", { use: "scene" }), undefined, {
			hosts: runtime(host, 1),
		});
		expect(host.mounts).toBe(1);
	});

	it("still mounts when reduced-motion media queries throw", () => {
		vi.stubGlobal("matchMedia", () => {
			throw new Error("unavailable");
		});
		const host = sceneHost();
		const root = document.createElement("div");
		renderIgniteJsx(root, jsx("canvas", { use: "scene" }), undefined, {
			hosts: runtime(host, 1),
		});
		expect(host.mounts).toBe(1);
	});
});
