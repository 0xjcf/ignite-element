import { afterEach, describe, expect, it, vi } from "vitest";
import { assign, createMachine, setup } from "xstate";
import type { Host } from "../hosts/types";
import { igniteCore } from "../IgniteCore";
import { jsx } from "../renderers/jsx/jsx-runtime";
import { createProjectionDocumentTarget } from "../runtime/projectionTargets";

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));
const tag = () => `host-${crypto.randomUUID()}`;

type LinkHandle = {
	audio: { closed: boolean };
	socket: { closed: boolean };
};

afterEach(() => {
	document.body.replaceChildren();
	vi.unstubAllGlobals();
});

describe("igniteCore hosts", () => {
	it("mounts a root host for an element-less lifecycle and disposes it on disconnect", async () => {
		const events: string[] = [];
		let handle: LinkHandle | undefined;
		const link: Host<
			HTMLDivElement,
			number,
			LinkHandle,
			{ context: { n: number } }
		> = {
			mount() {
				const audio = { closed: false };
				const socket = { closed: false };
				handle = { audio, socket };
				return handle;
			},
			update(_handle, slice) {
				events.push(`update:${slice}`);
			},
			dispose(current) {
				current.audio.closed = true;
				current.socket.closed = true;
				events.push("dispose");
			},
			select: (snapshot) => snapshot.context.n,
			describe: (slice) => `${slice} open`,
		};
		const machine = setup({
			types: {
				context: {} as { n: number },
				events: {} as { type: "PING" },
			},
			actions: {
				ping: assign({ n: ({ context }) => context.n + 1 }),
			},
		}).createMachine({
			context: { n: 0 },
			on: { PING: { actions: "ping" } },
		});
		const core = igniteCore({
			source: machine,
			hosts: { link },
			states: (snapshot) => ({ n: snapshot.context.n }),
		});
		expect(core).not.toHaveProperty("attachHost");
		expect(core).not.toHaveProperty("hosts");
		const name = tag();
		core(name, () => jsx("div", { use: "link" }));
		const element = document.createElement(name);
		document.body.append(element);
		const root = element.shadowRoot?.querySelector("div");
		expect(root?.getAttribute("aria-describedby")).toBeTruthy();
		expect(
			root?.querySelector(`[id="${root?.getAttribute("aria-describedby")}"]`)
				?.textContent,
		).toBe("0 open");
		expect(root?.getAttribute("aria-description")).toBeNull();
		expect(handle?.audio.closed).toBe(false);
		expect(handle?.socket.closed).toBe(false);
		expect(events).toEqual(["update:0"]);
		element.remove();
		await flush();
		expect(handle?.audio.closed).toBe(true);
		expect(handle?.socket.closed).toBe(true);
		expect(events).toContain("dispose");
		core.dispose();
	});

	it("sends host input through the core and updates only when the slice changes", async () => {
		const contexts: Array<{
			send: (event: { type: "PING" }) => void;
			readonly reducedMotion: boolean;
		}> = [];
		const updates: number[] = [];
		let mounts = 0;
		const scene: Host<
			HTMLCanvasElement,
			number,
			void,
			{ context: { n: number } }
		> = {
			mount(_el, ctx) {
				mounts += 1;
				contexts.push(ctx);
			},
			update(_handle, slice) {
				updates.push(slice);
			},
			dispose() {
				mounts -= 1;
			},
			select: (snapshot) => snapshot.context.n,
			equals: (a, b) => a === b,
			describe: (slice) => `count ${slice}`,
		};
		const machine = createMachine({
			types: {
				context: {} as { n: number },
				events: {} as { type: "PING" },
			},
			context: { n: 1 },
			on: {
				PING: {
					actions: assign({ n: ({ context }) => context.n + 1 }),
				},
			},
		});
		const core = igniteCore({
			source: machine,
			hosts: { scene },
		});
		const name = tag();
		let handle = "";
		core(name, (args) => {
			const hosts = Reflect.get(args, "hosts");
			if (
				hosts &&
				typeof hosts === "object" &&
				hosts !== null &&
				"scene" in hosts
			) {
				handle = String(Reflect.get(hosts, "scene"));
			}
			return jsx("canvas", { use: handle, "aria-label": "Orbit" });
		});
		const element = document.createElement(name);
		document.body.append(element);
		expect(handle).toBe("scene");
		const canvas = element.shadowRoot?.querySelector("canvas");
		expect(canvas?.getAttribute("aria-label")).toBe("Orbit");
		expect(
			canvas?.querySelector(
				`[id="${canvas?.getAttribute("aria-describedby")}"]`,
			)?.textContent,
		).toBe("count 1");
		expect(canvas?.hasAttribute("use")).toBe(false);
		expect(mounts).toBe(1);
		expect(updates).toEqual([1]);
		expect(contexts[0]?.reducedMotion).toBe(false);
		contexts[0]?.send({ type: "PING" });
		expect(updates).toEqual([1, 2]);
		expect(
			canvas?.querySelector(
				`[id="${canvas?.getAttribute("aria-describedby")}"]`,
			)?.textContent,
		).toBe("count 2");
		expect(mounts).toBe(1);
		element.remove();
		await flush();
		expect(mounts).toBe(0);
		core.dispose();
	});

	it("keeps a __proto__ host name as the handle string", async () => {
		let mounts = 0;
		const proto = Object.create(null) as Record<string, Host>;
		proto["__proto__"] = {
			mount() {
				mounts += 1;
				return { id: 1 };
			},
			dispose() {},
		};
		const machine = createMachine({
			types: { context: {} as { n: number } },
			context: { n: 1 },
		});
		let handle: unknown;
		const core = igniteCore({
			source: machine,
			hosts: proto,
		});
		const name = tag();
		core(name, (args) => {
			const table = (args as { hosts?: Record<string, unknown> }).hosts;
			handle = table?.["__proto__"];
			return jsx("div", { use: handle as string });
		});
		const element = document.createElement(name);
		document.body.append(element);
		await flush();
		expect(handle).toBe("__proto__");
		expect(mounts).toBe(1);
		element.remove();
		core.dispose();
	});

	it("treats an empty host map as no hosts and survives a broken reduced-motion query", () => {
		const machine = createMachine({
			types: { context: {} as { n: number } },
			context: { n: 1 },
		});
		const core = igniteCore({
			source: machine,
			hosts: {},
		});
		const name = tag();
		core(name, () => jsx("div", { use: "scene", children: "shown" }));
		const element = document.createElement(name);
		document.body.append(element);
		expect(element.shadowRoot?.textContent).toContain("shown");
		expect(element.shadowRoot?.querySelector("[aria-describedby]")).toBeNull();
		core.dispose();

		vi.stubGlobal("matchMedia", () => {
			throw new Error("unavailable");
		});
		let reduced = true;
		const scene: Host<
			HTMLDivElement,
			number,
			void,
			{ context: { n: number } }
		> = {
			mount(_el, ctx) {
				reduced = ctx.reducedMotion;
			},
			dispose() {},
			select: (snapshot) => snapshot.context.n,
		};
		const hosted = igniteCore({ source: machine, hosts: { scene } });
		const hostedName = tag();
		hosted(hostedName, () => jsx("div", { use: "scene" }));
		document.body.append(document.createElement(hostedName));
		expect(reduced).toBe(false);
		hosted.dispose();
	});

	it("projects host describe text to a document target without mounting", async () => {
		let mounts = 0;
		const committed: string[] = [];
		const machine = createMachine({
			types: { context: {} as { n: number } },
			context: { n: 3 },
		});
		const scene: Host<
			HTMLCanvasElement,
			number,
			void,
			{ context: { n: number } }
		> = {
			mount() {
				mounts += 1;
			},
			dispose() {},
			select: (snapshot) => snapshot.context.n,
			describe: (slice) => `angle ${slice}`,
		};
		const core = igniteCore({
			source: machine,
			hosts: { scene },
			states: () => ({
				projection: {
					documents: [
						{
							id: "panel",
							revision: "1",
							nodes: [{ kind: "text" as const, id: "summary", text: "Ready" }],
						},
					],
				},
			}),
		});
		const session = core(
			createProjectionDocumentTarget({
				commitDocument(document) {
					committed.push(
						document.nodes
							.map((node) => ("text" in node ? node.text : ""))
							.join("|"),
					);
				},
			}),
		);
		await flush();
		await flush();
		expect(mounts).toBe(0);
		expect(committed.some((text) => text.includes("angle 3"))).toBe(true);
		session.dispose();
		core.dispose();
	});
});
