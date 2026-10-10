import { afterEach, describe, expect, it, vi } from "vitest";
import {
	describeIgniteHosts,
	hostUnmountBindingsForTests,
} from "../../../../ignite-renderer/src/renderers/jsx/hosts";
import type { Host, HostContext } from "../../hosts/types";
import { createIgniteJsxRenderStrategy } from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { renderIgniteJsx } from "../../renderers/jsx/renderer";

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
	extras?: { send?: (event: unknown) => void },
) {
	return {
		snapshot,
		send: extras?.send ?? (() => undefined),
		reducedMotion: () => false,
		hosts: { scene: host },
	};
}

function hostDescription(element: Element | null | undefined): string | null {
	if (!element) return null;
	const id = element.getAttribute("aria-describedby");
	if (!id) return null;
	return element.querySelector(`[id="${id}"]`)?.textContent ?? null;
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
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
		vi.stubGlobal("window", undefined);
		const host = sceneHost();
		const root = document.createElement("div");
		renderIgniteJsx(root, jsx("canvas", { use: "scene" }), undefined, {
			hosts: runtime(host, 3),
		});
		const canvas = root.querySelector("canvas");
		expect(hostDescription(canvas)).toBe("angle 3");
		expect(canvas?.hasAttribute("aria-description")).toBe(false);
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
		expect(hostDescription(canvas)).toBe("angle 1");
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
		expect(hostDescription(canvas)).toBe("angle 2");
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

	it("stays quiet when use names a host on this core", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const root = document.createElement("div");
		renderIgniteJsx(root, jsx("canvas", { use: "scene" }), undefined, {
			hosts: runtime(sceneHost(), 1),
		});
		expect(warn).not.toHaveBeenCalled();
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

	it("warns about an unknown host even when NODE_ENV is production", () => {
		vi.stubEnv("NODE_ENV", "production");
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const root = document.createElement("div");
		renderIgniteJsx(root, jsx("canvas", { use: "missing" }), undefined, {
			hosts: runtime(sceneHost(), 1),
		});
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('Unknown host "missing"'),
		);
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
		expect(root.querySelector("canvas")?.hasAttribute("aria-describedby")).toBe(
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

	it("mounts a host only after its element is in the connected root", () => {
		const connected: boolean[] = [];
		const host = sceneHost({
			mount(el) {
				connected.push(el.isConnected);
				return { id: 1 };
			},
		});
		const root = document.createElement("div");
		document.body.append(root);
		renderIgniteJsx(
			root,
			jsx("section", {
				children: jsx("canvas", { use: "scene" }),
			}),
			undefined,
			{ hosts: runtime(host, 1) },
		);
		expect(connected).toEqual([true]);
	});

	it("reconciles replacement JSX after a host is retired", () => {
		const host = sceneHost();
		const root = document.createElement("div");
		const tree = renderIgniteJsx(
			root,
			jsx("div", { use: "scene" }),
			undefined,
			{ hosts: runtime(host, 1) },
		);
		expect(root.querySelector("[data-engine='scene']")).not.toBeNull();
		renderIgniteJsx(root, jsx("div", { children: "replacement" }), tree, {
			hosts: runtime(host, 1),
		});
		expect(root.querySelector("[data-engine='scene']")).toBeNull();
		expect(root.textContent).toContain("replacement");
	});

	it("disposes a synchronous mount that unmounts itself before returning", async () => {
		const root = document.createElement("div");
		const host = sceneHost({
			mount(_el, ctx) {
				ctx.send({ type: "drop" });
				return { id: 7 };
			},
		});
		const hosts = runtime(host, 1);
		let tree: ReturnType<typeof renderIgniteJsx> | undefined;
		hosts.send = () => {
			tree = renderIgniteJsx(root, jsx("p", { children: "gone" }), tree, {
				hosts,
			});
		};
		tree = renderIgniteJsx(root, jsx("canvas", { use: "scene" }), undefined, {
			hosts,
		});
		await new Promise<void>((resolve) => queueMicrotask(resolve));
		expect(host.disposed).toEqual([{ id: 7 }]);
		expect(host.updates).toEqual([]);
		expect(root.querySelector("canvas")).toBeNull();
		expect(root.textContent).toContain("gone");
	});

	it("keeps a single mount when mount sends before returning", async () => {
		const root = document.createElement("div");
		const host = sceneHost({
			mount(_el, ctx) {
				ctx.send({ type: "nudge" });
				return { id: 1 };
			},
		});
		const hosts = runtime(host, 1);
		let tree: ReturnType<typeof renderIgniteJsx> | undefined;
		hosts.send = () => {
			tree = renderIgniteJsx(root, jsx("canvas", { use: "scene" }), tree, {
				hosts: { ...hosts, snapshot: 2 },
			});
		};
		tree = renderIgniteJsx(root, jsx("canvas", { use: "scene" }), undefined, {
			hosts,
		});
		await new Promise<void>((resolve) => queueMicrotask(resolve));
		expect(host.mounts).toBe(1);
		expect(host.disposed).toEqual([]);
		expect(root.querySelector("canvas")).not.toBeNull();
	});

	it("keeps sibling UI when select or equals throws", () => {
		const error = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const selecting = sceneHost();
		selecting.select = () => {
			throw new Error("select failed");
		};
		const root = document.createElement("div");
		let tree = renderIgniteJsx(
			root,
			jsx("div", {
				children: [
					jsx("canvas", { use: "scene" }),
					jsx("p", { children: "kept" }),
				],
			}),
			undefined,
			{ hosts: { ...runtime(selecting, 1), hosts: { scene: selecting } } },
		);
		expect(root.querySelector("p")?.textContent).toBe("kept");
		expect(selecting.mounts).toBe(0);

		const equating = sceneHost();
		equating.equals = () => {
			throw new Error("equals failed");
		};
		tree = renderIgniteJsx(root, jsx("canvas", { use: "scene" }), undefined, {
			hosts: { ...runtime(equating, 1), hosts: { scene: equating } },
		});
		expect(() =>
			renderIgniteJsx(root, jsx("canvas", { use: "scene" }), tree, {
				hosts: { ...runtime(equating, 2), hosts: { scene: equating } },
			}),
		).not.toThrow();
		expect(
			root.querySelector("p")?.textContent ?? root.textContent,
		).toBeTruthy();
		expect(error.mock.calls.map((call) => String(call[0]))).toEqual(
			expect.arrayContaining([
				expect.stringContaining("Host select failed."),
				expect.stringContaining("Host equals failed."),
			]),
		);
	});

	it("retries mount after an async rejection and drops the motion listener", async () => {
		const listeners = new Set<() => void>();
		vi.stubGlobal("matchMedia", () => ({
			addEventListener: (_name: string, listener: () => void) => {
				listeners.add(listener);
			},
			removeEventListener: (_name: string, listener: () => void) => {
				listeners.delete(listener);
			},
		}));
		let rejectMount: (error: Error) => void = () => undefined;
		let fail = true;
		const host = sceneHost({
			mount: () =>
				fail
					? new Promise((_resolve, reject) => {
							rejectMount = reject;
						})
					: { id: 2 },
		});
		const root = document.createElement("div");
		const tree = renderIgniteJsx(
			root,
			jsx("canvas", { use: "scene" }),
			undefined,
			{ hosts: runtime(host, 1) },
		);
		rejectMount(new Error("mount rejected"));
		await Promise.resolve();
		await Promise.resolve();
		expect(listeners.size).toBe(0);
		fail = false;
		renderIgniteJsx(root, jsx("canvas", { use: "scene" }), tree, {
			hosts: runtime(host, 2),
		});
		expect(host.mounts).toBe(2);
	});

	it("reports a throwing describe from the snapshot helper", () => {
		const error = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const host = sceneHost();
		host.describe = () => {
			throw new Error("describe failed");
		};
		expect(describeIgniteHosts({ scene: host }, 4)).toEqual({});
		expect(host.mounts).toBe(0);
		expect(error.mock.calls.map((call) => String(call[0]))).toEqual(
			expect.arrayContaining([
				expect.stringContaining("Host describe failed."),
			]),
		);
	});

	it("does not mount a nested host under an owned host, and unmount disposes it", () => {
		const child = sceneHost();
		const parent = sceneHost({
			mount(el) {
				el.replaceChildren();
				return { id: 1 };
			},
		});
		const hosts = {
			snapshot: 1,
			send: () => undefined,
			reducedMotion: () => false,
			hosts: { parent, child },
		};
		const root = document.createElement("div");
		let tree = renderIgniteJsx(
			root,
			jsx("div", {
				children: jsx("canvas", { use: "child" }),
			}),
			undefined,
			{ hosts },
		);
		expect(child.mounts).toBe(1);
		expect(child.disposed).toEqual([]);

		tree = renderIgniteJsx(
			root,
			jsx("div", {
				use: "parent",
				children: jsx("canvas", { use: "child" }),
			}),
			tree,
			{ hosts },
		);
		expect(child.disposed).toHaveLength(1);
		expect(child.mounts).toBe(1);
		expect(parent.mounts).toBe(1);

		renderIgniteJsx(root, null, tree, { hosts });
		expect(parent.disposed).toHaveLength(1);
		expect(child.disposed).toHaveLength(child.mounts);
	});

	it("keeps the accessible description after the host replaces its subtree", () => {
		let element: Element | undefined;
		const host = sceneHost({
			mount(el) {
				element = el;
				el.replaceChildren();
				return { id: 1 };
			},
			update() {
				element?.replaceChildren();
			},
		});
		const root = document.createElement("div");
		const tree = renderIgniteJsx(
			root,
			jsx("canvas", { use: "scene" }),
			undefined,
			{ hosts: runtime(host, 1) },
		);
		const canvas = root.querySelector("canvas");
		expect(canvas?.getAttribute("aria-describedby")).toBeTruthy();
		expect(
			canvas?.querySelector(`[id="${canvas.getAttribute("aria-describedby")}"]`)
				?.textContent,
		).toBe("angle 1");

		renderIgniteJsx(root, jsx("canvas", { use: "scene" }), tree, {
			hosts: runtime(host, 4),
		});
		const next = root.querySelector("canvas");
		expect(
			next?.querySelector(`[id="${next.getAttribute("aria-describedby")}"]`)
				?.textContent,
		).toBe("angle 4");
	});

	it("reapplies the description after an async mount replaces the subtree", async () => {
		const host = sceneHost({
			mount(el) {
				return Promise.resolve().then(() => {
					el.replaceChildren();
					return { id: 1 };
				});
			},
		});
		const root = document.createElement("div");
		document.body.append(root);
		renderIgniteJsx(root, jsx("canvas", { use: "scene" }), undefined, {
			hosts: runtime(host, 2),
		});
		await Promise.resolve();
		await Promise.resolve();
		expect(hostDescription(root.querySelector("canvas"))).toBe("angle 2");
	});

	it("disposes the host before innerHTML or textContent becomes final", () => {
		const clearOnDispose = () => {
			let element: Element | null = null;
			const host = sceneHost({
				mount(el) {
					element = el;
					return { id: 1 };
				},
				dispose() {
					element?.replaceChildren();
				},
			});
			return host;
		};
		const rich = clearOnDispose();
		const root = document.createElement("div");
		document.body.append(root);
		const tree = renderIgniteJsx(
			root,
			jsx("section", { use: "scene" }),
			undefined,
			{ hosts: runtime(rich, 1) },
		);
		renderIgniteJsx(root, jsx("section", { innerHTML: "<p>kept</p>" }), tree, {
			hosts: runtime(rich, 1),
		});
		expect(rich.disposed).toHaveLength(1);
		expect(root.querySelector("p")?.textContent).toBe("kept");

		const plain = clearOnDispose();
		const textRoot = document.createElement("div");
		document.body.append(textRoot);
		const textTree = renderIgniteJsx(
			textRoot,
			jsx("section", { use: "scene" }),
			undefined,
			{ hosts: runtime(plain, 1) },
		);
		renderIgniteJsx(
			textRoot,
			jsx("section", { textContent: "plain" }),
			textTree,
			{ hosts: runtime(plain, 1) },
		);
		expect(plain.disposed).toHaveLength(1);
		expect(textRoot.querySelector("section")?.textContent).toBe("plain");
	});

	it("disposes the new host after a reconnect of the same element", () => {
		const host = sceneHost();
		const element = document.createElement("div");
		Object.defineProperty(element, "__igniteHostRuntime", {
			configurable: true,
			value: runtime(host, 1),
		});
		document.body.append(element);
		const shadow = element.attachShadow({ mode: "open" });
		const strategy = createIgniteJsxRenderStrategy();
		strategy.attach(shadow);
		strategy.render(jsx("canvas", { use: "scene" }));
		expect(host.mounts).toBe(1);
		strategy.releaseView?.();
		expect(host.disposed).toHaveLength(1);
		strategy.render(jsx("canvas", { use: "scene" }));
		expect(host.mounts).toBe(2);
		strategy.releaseView?.();
		expect(host.disposed).toHaveLength(2);
	});

	it("does not recurse when update sends during delivery", async () => {
		let depth = 0;
		let maxDepth = 0;
		let calls = 0;
		const root = document.createElement("div");
		let tree: ReturnType<typeof renderIgniteJsx> | undefined;
		const host = sceneHost({
			mount: () => Promise.resolve({ id: 1 }),
			update() {
				depth += 1;
				maxDepth = Math.max(maxDepth, depth);
				calls += 1;
				if (calls === 1) {
					tree = renderIgniteJsx(root, jsx("canvas", { use: "scene" }), tree, {
						hosts: runtime(host, 2, {
							send: () => undefined,
						}),
					});
				}
				depth -= 1;
			},
		});
		tree = renderIgniteJsx(root, jsx("canvas", { use: "scene" }), undefined, {
			hosts: runtime(host, 1),
		});
		await Promise.resolve();
		await Promise.resolve();
		expect(maxDepth).toBe(1);
		expect(calls).toBe(2);
		expect(host.updates).toEqual([{ angle: 1 }, { angle: 2 }]);
	});

	it("retires a mounted host when a later select throws", () => {
		const error = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		let fail = false;
		const host = sceneHost();
		host.select = (snapshot) => {
			if (fail) throw new Error("select failed");
			return { angle: snapshot };
		};
		const root = document.createElement("div");
		let tree = renderIgniteJsx(
			root,
			jsx("canvas", { use: "scene" }),
			undefined,
			{ hosts: runtime(host, 1) },
		);
		expect(host.mounts).toBe(1);
		fail = true;
		tree = renderIgniteJsx(root, jsx("canvas", { use: "scene" }), tree, {
			hosts: runtime(host, 2),
		});
		expect(host.disposed).toHaveLength(1);
		expect(host.mounts).toBe(1);
		fail = false;
		renderIgniteJsx(root, jsx("canvas", { use: "scene" }), tree, {
			hosts: runtime(host, 3),
		});
		expect(host.mounts).toBe(2);
		expect(error.mock.calls.map((call) => String(call[0]))).toEqual(
			expect.arrayContaining([expect.stringContaining("Host select failed.")]),
		);
	});

	it("does not reuse an authored accessible-description id", () => {
		for (let index = 1; index <= 64; index += 1) {
			const authored = document.createElement("span");
			authored.id = `ignite-host-desc-${index}`;
			authored.textContent = "authored";
			document.body.append(authored);
		}
		const host = sceneHost();
		const root = document.createElement("div");
		document.body.append(root);
		renderIgniteJsx(root, jsx("canvas", { use: "scene" }), undefined, {
			hosts: runtime(host, 2),
		});
		const canvas = root.querySelector("canvas");
		const id = canvas?.getAttribute("aria-describedby");
		expect(id).toBeTruthy();
		expect(document.getElementById(id ?? "")?.textContent).toBe("angle 2");
		expect(document.querySelectorAll(`[id="${id}"]`)).toHaveLength(1);
	});

	it("keeps one unmount hook when a host is retired and mounted again", () => {
		const before = hostUnmountBindingsForTests();
		const host = sceneHost();
		const root = document.createElement("div");
		document.body.append(root);
		let tree = renderIgniteJsx(
			root,
			jsx("canvas", { use: "scene" }),
			undefined,
			{ hosts: runtime(host, 1) },
		);
		for (let index = 0; index < 4; index += 1) {
			tree = renderIgniteJsx(root, jsx("canvas", {}), tree, {
				hosts: runtime(host, 1),
			});
			tree = renderIgniteJsx(root, jsx("canvas", { use: "scene" }), tree, {
				hosts: runtime(host, 1),
			});
		}
		expect(hostUnmountBindingsForTests() - before).toBe(1);
		expect(host.mounts).toBe(5);
		expect(host.disposed).toHaveLength(4);
	});

	it("does not treat an inherited host name as a declared host", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const child = sceneHost();
		const root = document.createElement("div");
		document.body.append(root);
		renderIgniteJsx(
			root,
			jsx("div", {
				use: "constructor",
				children: jsx("canvas", { use: "child" }),
			}),
			undefined,
			{
				hosts: {
					snapshot: 1,
					send: () => undefined,
					reducedMotion: () => false,
					hosts: { child },
				},
			},
		);
		expect(child.mounts).toBe(1);
		expect(warn.mock.calls.map((call) => String(call[0]))).toEqual(
			expect.arrayContaining([
				expect.stringContaining('Unknown host "constructor"'),
			]),
		);
	});

	it("commits descendant hosts and refs when the first use name is rejected", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const error = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const parent = sceneHost();
		parent.select = () => {
			throw new Error("select failed");
		};
		const child = sceneHost();
		const seen: { current: Element | null } = { current: null };
		const root = document.createElement("div");
		document.body.append(root);
		const hosts = {
			snapshot: 1,
			send: () => undefined,
			reducedMotion: () => false,
			hosts: { scene: parent, child },
		};
		renderIgniteJsx(
			root,
			jsx("section", {
				use: "missing",
				children: jsx("canvas", {
					use: "child",
					ref: (element: Element | null) => {
						seen.current = element;
					},
				}),
			}),
			undefined,
			{ hosts },
		);
		expect(child.mounts).toBe(1);
		expect(seen.current?.tagName).toBe("CANVAS");
		expect(warn.mock.calls.map((call) => String(call[0]))).toEqual(
			expect.arrayContaining([
				expect.stringContaining('Unknown host "missing"'),
			]),
		);

		renderIgniteJsx(
			root,
			jsx("section", {
				use: "scene",
				children: jsx("canvas", {
					use: "child",
					ref: (element: Element | null) => {
						seen.current = element;
					},
				}),
			}),
			undefined,
			{ hosts },
		);
		expect(parent.mounts).toBe(0);
		expect(child.mounts).toBe(2);
		expect(seen.current?.tagName).toBe("CANVAS");
		expect(error.mock.calls.map((call) => String(call[0]))).toEqual(
			expect.arrayContaining([expect.stringContaining("Host select failed.")]),
		);
	});

	it("keeps an own __proto__ description", () => {
		const host = sceneHost();
		const hosts = Object.create(null) as Record<string, typeof host>;
		Object.defineProperty(hosts, "__proto__", {
			value: host,
			enumerable: true,
			configurable: true,
			writable: true,
		});
		const text = describeIgniteHosts(hosts, 4);
		expect(Object.getOwnPropertyDescriptor(text, "__proto__")?.value).toBe(
			"angle 4",
		);
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
