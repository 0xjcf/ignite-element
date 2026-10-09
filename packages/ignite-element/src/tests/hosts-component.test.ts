import { afterEach, describe, expect, it } from "vitest";
import { assign, createMachine, setup } from "xstate";
import type { Host } from "../hosts/types";
import { igniteCore } from "../IgniteCore";
import { jsx } from "../renderers/jsx/jsx-runtime";

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));
const tag = () => `host-${crypto.randomUUID()}`;

type LinkHandle = {
	audio: { closed: boolean };
	socket: { closed: boolean };
};

afterEach(() => {
	document.body.replaceChildren();
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
		expect(root?.getAttribute("aria-description")).toBe("0 open");
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
		const contexts: Array<{ send: (event: { type: "PING" }) => void }> = [];
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
		core(name, () => jsx("canvas", { use: "scene", "aria-label": "Orbit" }));
		const element = document.createElement(name);
		document.body.append(element);
		const canvas = element.shadowRoot?.querySelector("canvas");
		expect(canvas?.getAttribute("aria-label")).toBe("Orbit");
		expect(canvas?.getAttribute("aria-description")).toBe("count 1");
		expect(canvas?.hasAttribute("use")).toBe(false);
		expect(mounts).toBe(1);
		expect(updates).toEqual([1]);
		contexts[0]?.send({ type: "PING" });
		expect(updates).toEqual([1, 2]);
		expect(canvas?.getAttribute("aria-description")).toBe("count 2");
		expect(mounts).toBe(1);
		element.remove();
		await flush();
		expect(mounts).toBe(0);
		core.dispose();
	});
});
