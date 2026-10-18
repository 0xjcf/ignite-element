import { describe, expect, it, vi } from "vitest";
import "../../../../ignite-renderer/src/renderers/jsx/hosts";
import { jsx } from "../../../../ignite-renderer/src/renderers/jsx/jsx-runtime";
import { renderIgniteJsx } from "../../../../ignite-renderer/src/renderers/jsx/renderer";

// V2 (PR #168, round 11): host callbacks are user code. A select, mount,
// update or describe that supersedes the commit stops it. This file imports one
// renderer instance only, so the host bridge reaches the renderer under test.
type Rec = {
	select: number;
	mount: number;
	update: number;
	dispose: number;
	describe?: number;
	equals?: number;
};
const hostFor = (rec: Rec, hooks: Partial<Record<keyof Rec, () => void>>) => ({
	select: (n: unknown) => {
		rec.select++;
		hooks.select?.();
		return n;
	},
	mount: (el: Element) => {
		rec.mount++;
		hooks.mount?.();
		const child = document.createElement("span");
		el.append(child);
		return { id: rec.mount };
	},
	update: () => {
		rec.update++;
		hooks.update?.();
	},
	dispose: () => {
		rec.dispose++;
	},
	equals: () => {
		rec.equals = (rec.equals ?? 0) + 1;
		hooks.equals?.();
		return false;
	},
	describe: () => {
		rec.describe = (rec.describe ?? 0) + 1;
		hooks.describe?.();
		return "d";
	},
});

describe("V2 host callbacks are checked for supersession", () => {
	const run = (
		hooks: (root: HTMLElement) => Partial<Record<keyof Rec, () => void>>,
	) => {
		const rec: Rec = { select: 0, mount: 0, update: 0, dispose: 0 };
		const root = document.createElement("div");
		document.body.append(root);
		renderIgniteJsx(root, jsx("div", {}), undefined, undefined);
		const supersede = () =>
			renderIgniteJsx(root, jsx("p", {}), undefined, undefined);
		const host = hostFor(rec, hooks(root) as never);
		const hosts = {
			snapshot: 1,
			send: () => undefined,
			reducedMotion: () => false,
			hosts: { scene: host as never },
		};
		return { rec, root, supersede, hosts };
	};
	it("a select that supersedes stops the mount", () => {
		const ctx = run(() => ({}));
		const host = hostFor(ctx.rec, { select: ctx.supersede });
		ctx.hosts.hosts.scene = host as never;
		renderIgniteJsx(
			ctx.root,
			jsx("div", { children: jsx("canvas", { use: "scene" }) }),
			undefined,
			{
				hosts: ctx.hosts,
			},
		);
		expect(ctx.rec.mount).toBe(0);
	});
	it("a mount that supersedes disposes its handle and delivers nothing", () => {
		const ctx = run(() => ({}));
		const host = hostFor(ctx.rec, { mount: ctx.supersede });
		ctx.hosts.hosts.scene = host as never;
		renderIgniteJsx(
			ctx.root,
			jsx("div", { children: jsx("canvas", { use: "scene" }) }),
			undefined,
			{
				hosts: ctx.hosts,
			},
		);
		return Promise.resolve().then(() => {
			expect(ctx.rec.update).toBe(0);
			expect(ctx.rec.describe ?? 0).toBe(0);
			expect(ctx.rec.dispose).toBe(1);
		});
	});
	it("an update that supersedes stops the description", () => {
		const ctx = run(() => ({}));
		const host = hostFor(ctx.rec, { update: ctx.supersede });
		ctx.hosts.hosts.scene = host as never;
		renderIgniteJsx(
			ctx.root,
			jsx("div", { children: jsx("canvas", { use: "scene" }) }),
			undefined,
			{
				hosts: ctx.hosts,
			},
		);
		expect(ctx.rec.describe ?? 0).toBe(0);
	});
	it("an update on a retained host that supersedes stops the description", () => {
		const ctx = run(() => ({}));
		let superseding = false;
		const host = hostFor(ctx.rec, {
			update: () => {
				if (superseding) ctx.supersede();
			},
		});
		ctx.hosts.hosts.scene = host as never;
		const view = jsx("div", { children: jsx("canvas", { use: "scene" }) });
		const tree = renderIgniteJsx(ctx.root, view, undefined, {
			hosts: ctx.hosts,
		});
		const before = ctx.rec.describe ?? 0;
		const updates = ctx.rec.update;
		superseding = true;
		renderIgniteJsx(ctx.root, view, tree, {
			hosts: { ...ctx.hosts, snapshot: 2 },
		});
		expect(ctx.rec.update).toBe(updates + 1);
		expect(ctx.rec.describe ?? 0).toBe(before);
	});
	const pair = jsx("div", {
		children: [
			jsx("canvas", { use: "scene" }),
			jsx("canvas", { use: "scene" }),
		],
	});
	it("a describe that supersedes a fresh host stops its later siblings", () => {
		const ctx = run(() => ({}));
		ctx.hosts.hosts.scene = hostFor(ctx.rec, {
			describe: ctx.supersede,
		}) as never;
		renderIgniteJsx(ctx.root, pair, undefined, { hosts: ctx.hosts });
		expect(ctx.rec.select).toBe(1);
	});
	it("a describe that supersedes a retained host stops its later siblings", () => {
		const ctx = run(() => ({}));
		let superseding = false;
		ctx.hosts.hosts.scene = hostFor(ctx.rec, {
			describe: () => {
				if (superseding) ctx.supersede();
			},
		}) as never;
		const tree = renderIgniteJsx(ctx.root, pair, undefined, {
			hosts: ctx.hosts,
		});
		const selects = ctx.rec.select;
		superseding = true;
		renderIgniteJsx(ctx.root, pair, tree, {
			hosts: { ...ctx.hosts, snapshot: 2 },
		});
		expect(ctx.rec.select).toBe(selects + 1);
	});
	it("a describe that supersedes a fresh host is not followed by a second describe", () => {
		const ctx = run(() => ({}));
		ctx.hosts.hosts.scene = hostFor(ctx.rec, {
			describe: ctx.supersede,
		}) as never;
		renderIgniteJsx(
			ctx.root,
			jsx("div", { children: jsx("canvas", { use: "scene" }) }),
			undefined,
			{ hosts: ctx.hosts },
		);
		expect(ctx.rec.describe).toBe(1);
		expect(ctx.root.querySelector("[aria-describedby]")).toBeNull();
	});
	it("an equals that supersedes a retained host stops its update", () => {
		const ctx = run(() => ({}));
		let superseding = false;
		ctx.hosts.hosts.scene = hostFor(ctx.rec, {
			equals: () => {
				if (superseding) ctx.supersede();
			},
		}) as never;
		const view = jsx("div", { children: jsx("canvas", { use: "scene" }) });
		const tree = renderIgniteJsx(ctx.root, view, undefined, {
			hosts: ctx.hosts,
		});
		const updates = ctx.rec.update;
		superseding = true;
		renderIgniteJsx(ctx.root, view, tree, {
			hosts: { ...ctx.hosts, snapshot: 2 },
		});
		expect(ctx.rec.equals).toBeGreaterThan(0);
		expect(ctx.rec.update).toBe(updates);
	});
	it("a superseded async mount that rejects is reported, not unhandled", async () => {
		const ctx = run(() => ({}));
		const unhandled = vi.fn();
		process.on("unhandledRejection", unhandled);
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		const host = hostFor(ctx.rec, { mount: ctx.supersede });
		host.mount = () => {
			ctx.rec.mount++;
			ctx.supersede();
			return Promise.reject(new Error("late")) as never;
		};
		ctx.hosts.hosts.scene = host as never;
		renderIgniteJsx(
			ctx.root,
			jsx("div", { children: jsx("canvas", { use: "scene" }) }),
			undefined,
			{ hosts: ctx.hosts },
		);
		await new Promise((resolve) => setTimeout(resolve, 20));
		process.off("unhandledRejection", unhandled);
		const reported = errors.mock.calls.some((call) =>
			String(call[0]).includes("Host mount failed"),
		);
		errors.mockRestore();
		expect(unhandled).not.toHaveBeenCalled();
		expect(reported).toBe(true);
	});
	it("an async mount whose update supersedes does not describe or write the description", async () => {
		const ctx = run(() => ({}));
		const host = hostFor(ctx.rec, { update: ctx.supersede });
		host.mount = (el: Element) => {
			ctx.rec.mount++;
			el.append(document.createElement("span"));
			return Promise.resolve({ id: 1 }) as never;
		};
		ctx.hosts.hosts.scene = host as never;
		renderIgniteJsx(
			ctx.root,
			jsx("div", { children: jsx("canvas", { use: "scene" }) }),
			undefined,
			{ hosts: ctx.hosts },
		);
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(ctx.rec.update).toBe(1);
		// One describe ran while the mount was pending; none after it settled.
		expect(ctx.rec.describe).toBe(1);
		expect(ctx.rec.dispose).toBe(1);
	});
	it("a mount that supersedes and then throws stops the description", async () => {
		const ctx = run(() => ({}));
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		const host = hostFor(ctx.rec, {});
		host.mount = () => {
			ctx.rec.mount++;
			ctx.supersede();
			throw new Error("boom");
		};
		ctx.hosts.hosts.scene = host as never;
		renderIgniteJsx(
			ctx.root,
			jsx("div", { children: jsx("canvas", { use: "scene" }) }),
			undefined,
			{ hosts: ctx.hosts },
		);
		await new Promise((resolve) => setTimeout(resolve, 10));
		errors.mockRestore();
		expect(ctx.rec.describe ?? 0).toBe(0);
		expect(ctx.rec.dispose).toBe(0);
	});
	it("a dispose that supersedes while a retained element switches hosts stops the new mount", () => {
		const ctx = run(() => ({}));
		let superseding = false;
		const a = hostFor(ctx.rec, {});
		a.dispose = () => {
			ctx.rec.dispose++;
			if (superseding) ctx.supersede();
		};
		const other: Rec = { select: 0, mount: 0, update: 0, dispose: 0 };
		const b = hostFor(other, {});
		ctx.hosts.hosts.scene = a as never;
		(ctx.hosts.hosts as Record<string, unknown>).other = b;
		const view = (use: string) =>
			jsx("div", { children: jsx("canvas", { use }) });
		const tree = renderIgniteJsx(ctx.root, view("scene"), undefined, {
			hosts: ctx.hosts,
		});
		superseding = true;
		renderIgniteJsx(ctx.root, view("other"), tree, { hosts: ctx.hosts });
		expect(ctx.rec.dispose).toBe(1);
		expect(other.mount).toBe(0);
	});
	it("an update that supersedes with a redeliver pending does not update again", () => {
		const listeners: (() => void)[] = [];
		vi.stubGlobal("matchMedia", () => ({
			addEventListener: (_: string, l: () => void) => listeners.push(l),
			removeEventListener: () => undefined,
		}));
		try {
			const ctx = run(() => ({}));
			let superseding = false;
			ctx.hosts.hosts.scene = hostFor(ctx.rec, {
				update: () => {
					if (!superseding) return;
					for (const l of listeners) l();
					ctx.supersede();
				},
			}) as never;
			const view = jsx("div", { children: jsx("canvas", { use: "scene" }) });
			const tree = renderIgniteJsx(ctx.root, view, undefined, {
				hosts: ctx.hosts,
			});
			const updates = ctx.rec.update;
			superseding = true;
			renderIgniteJsx(ctx.root, view, tree, {
				hosts: { ...ctx.hosts, snapshot: 2 },
			});
			expect(ctx.rec.update).toBe(updates + 1);
		} finally {
			vi.unstubAllGlobals();
		}
	});
	it("a describe that supersedes after an async settle writes nothing", async () => {
		const ctx = run(() => ({}));
		const host = hostFor(ctx.rec, {});
		host.mount = (el: Element) => {
			ctx.rec.mount++;
			el.append(document.createElement("i"));
			return Promise.resolve({ id: 1 }) as never;
		};
		host.describe = () => {
			ctx.rec.describe = (ctx.rec.describe ?? 0) + 1;
			if (ctx.rec.describe === 2) ctx.supersede();
			return `d${ctx.rec.describe}`;
		};
		ctx.hosts.hosts.scene = host as never;
		renderIgniteJsx(
			ctx.root,
			jsx("div", { children: jsx("canvas", { use: "scene" }) }),
			undefined,
			{ hosts: ctx.hosts },
		);
		const stale = ctx.root.querySelector("canvas") as Element;
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(ctx.rec.describe).toBe(2);
		expect(
			stale.querySelector("[data-ignite-host-description]")?.textContent,
		).toBe("d1");
	});
	it("a dispose that supersedes while a host is dropped leaves the stale description", () => {
		const ctx = run(() => ({}));
		let superseding = false;
		const host = hostFor(ctx.rec, {});
		host.dispose = () => {
			ctx.rec.dispose++;
			if (superseding) ctx.supersede();
		};
		ctx.hosts.hosts.scene = host as never;
		const tree = renderIgniteJsx(
			ctx.root,
			jsx("div", { children: jsx("canvas", { use: "scene" }) }),
			undefined,
			{ hosts: ctx.hosts },
		);
		const stale = ctx.root.querySelector("canvas") as Element;
		superseding = true;
		renderIgniteJsx(
			ctx.root,
			jsx("div", { children: jsx("canvas", {}) }),
			tree,
			{ hosts: ctx.hosts },
		);
		expect(ctx.rec.dispose).toBe(1);
		expect(
			stale.querySelector("[data-ignite-host-description]"),
		).not.toBeNull();
	});
	it("an equals outside a commit that supersedes stops the deferred update", async () => {
		const listeners: (() => void)[] = [];
		vi.stubGlobal("matchMedia", () => ({
			addEventListener: (_: string, l: () => void) => listeners.push(l),
			removeEventListener: () => undefined,
		}));
		try {
			const ctx = run(() => ({}));
			let superseding = false;
			const host = hostFor(ctx.rec, {
				equals: () => {
					if (superseding) ctx.supersede();
				},
				update: () => {
					if (ctx.rec.update === 1) {
						superseding = true;
						for (const l of listeners) l();
					}
				},
			});
			(host as { mount: unknown }).mount = (
				el: Element,
				hostCtx: { send(event: unknown): void },
			) => {
				ctx.rec.mount++;
				el.append(document.createElement("span"));
				hostCtx.send("x");
				return { id: 1 } as never;
			};
			ctx.hosts.hosts.scene = host as never;
			renderIgniteJsx(
				ctx.root,
				jsx("div", { children: jsx("canvas", { use: "scene" }) }),
				undefined,
				{ hosts: ctx.hosts },
			);
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(ctx.rec.update).toBe(1);
		} finally {
			vi.unstubAllGlobals();
		}
	});
	it("a descendant dispose that supersedes stops the new parent mount", () => {
		const ctx = run(() => ({}));
		let superseding = false;
		const inner = hostFor(ctx.rec, {});
		inner.dispose = () => {
			ctx.rec.dispose++;
			if (superseding) ctx.supersede();
		};
		const outer: Rec = { select: 0, mount: 0, update: 0, dispose: 0 };
		ctx.hosts.hosts.scene = inner as never;
		(ctx.hosts.hosts as Record<string, unknown>).outer = hostFor(outer, {});
		const tree = renderIgniteJsx(
			ctx.root,
			jsx("div", { children: jsx("canvas", { use: "scene" }) }),
			undefined,
			{ hosts: ctx.hosts },
		);
		superseding = true;
		renderIgniteJsx(
			ctx.root,
			jsx("div", { use: "outer", children: jsx("canvas", { use: "scene" }) }),
			tree,
			{ hosts: ctx.hosts },
		);
		expect(outer.mount).toBe(0);
	});
	it("an own setter that supersedes and then throws stops the host sync", () => {
		const ctx = run(() => ({}));
		let superseding = false;
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		customElements.define(
			"x-r14-throws",
			class extends HTMLElement {
				constructor() {
					super();
					Object.defineProperty(this, "foo", {
						configurable: true,
						set: () => {
							if (!superseding) return;
							ctx.supersede();
							throw new Error("setter");
						},
					});
				}
			},
		);
		ctx.hosts.hosts.scene = hostFor(ctx.rec, {}) as never;
		const view = (foo: number) =>
			jsx("div", {
				children: jsx("x-r14-throws", { use: "scene", foo }),
			});
		const tree = renderIgniteJsx(ctx.root, view(0), undefined, {
			hosts: ctx.hosts,
		});
		const selects = ctx.rec.select;
		superseding = true;
		renderIgniteJsx(ctx.root, view(1), tree, { hosts: ctx.hosts });
		errors.mockRestore();
		expect(ctx.rec.select).toBe(selects);
	});
	it("an own getter that supersedes and then throws stops the host sync", () => {
		const ctx = run(() => ({}));
		let superseding = false;
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		customElements.define(
			"x-r14-getter",
			class extends HTMLElement {
				constructor() {
					super();
					Object.defineProperty(this, "bar", {
						configurable: true,
						get: () => {
							if (!superseding) return;
							ctx.supersede();
							throw new Error("setter");
						},
					});
				}
			},
		);
		ctx.hosts.hosts.scene = hostFor(ctx.rec, {}) as never;
		const view = (bar: number) =>
			jsx("div", {
				children: jsx("x-r14-getter", { use: "scene", bar }),
			});
		const tree = renderIgniteJsx(ctx.root, view(0), undefined, {
			hosts: ctx.hosts,
		});
		const selects = ctx.rec.select;
		superseding = true;
		renderIgniteJsx(ctx.root, view(1), tree, { hosts: ctx.hosts });
		errors.mockRestore();
		expect(ctx.rec.select).toBe(selects);
	});
	it("a host element method that supersedes stops the description writes", () => {
		const ctx = run(() => ({}));
		let trig = false;
		let seen: Element | undefined;
		customElements.define(
			"x-r16-host",
			class extends HTMLElement {
				append(...nodes: (Node | string)[]) {
					const first = nodes[0];
					if (
						trig &&
						first instanceof HTMLElement &&
						first.hasAttribute("data-ignite-host-description")
					) {
						trig = false;
						seen = this;
						ctx.supersede();
					}
					super.append(...nodes);
				}
			},
		);
		ctx.hosts.hosts.scene = hostFor(ctx.rec, {}) as never;
		trig = true;
		renderIgniteJsx(
			ctx.root,
			jsx("div", { children: jsx("x-r16-host", { use: "scene" }) }),
			undefined,
			{ hosts: ctx.hosts },
		);
		expect(seen).toBeDefined();
		expect(seen?.hasAttribute("aria-describedby")).toBe(false);
		expect(
			seen?.querySelector("[data-ignite-host-description]")?.textContent,
		).toBe("");
	});
	it("a mount that sends and returns a fulfilled promise delivers after the send", async () => {
		const ctx = run(() => ({}));
		const log: string[] = [];
		const host = {
			select: (n: unknown) => n,
			mount: (_el: Element, hostCtx: { send(event: unknown): void }) => {
				hostCtx.send("x");
				return Promise.resolve({ id: 1 });
			},
			update: () => void log.push("update"),
			dispose: () => undefined,
		};
		ctx.hosts.send = () => void log.push("send");
		ctx.hosts.hosts.scene = host as never;
		renderIgniteJsx(
			ctx.root,
			jsx("div", { children: jsx("canvas", { use: "scene" }) }),
			undefined,
			{ hosts: ctx.hosts },
		);
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(log).toEqual(["send", "update"]);
	});
	it("an abort listener that supersedes still disposes the old host once and stops the new mount", () => {
		const ctx = run(() => ({}));
		let superseding = false;
		const hostA = hostFor(ctx.rec, {});
		const other: Rec = { select: 0, mount: 0, update: 0, dispose: 0 };
		const hostB = hostFor(other, {});
		(hostA as { mount: unknown }).mount = (
			el: Element,
			hostCtx: { signal: AbortSignal },
		) => {
			ctx.rec.mount++;
			el.append(document.createElement("span"));
			hostCtx.signal.addEventListener("abort", () => {
				if (superseding) ctx.supersede();
			});
			return { id: 1 } as never;
		};
		(ctx.hosts.hosts as Record<string, unknown>).a = hostA;
		(ctx.hosts.hosts as Record<string, unknown>).b = hostB;
		const view = (use: string) =>
			jsx("div", { children: jsx("canvas", { use }) });
		const tree = renderIgniteJsx(ctx.root, view("a"), undefined, {
			hosts: ctx.hosts,
		});
		superseding = true;
		renderIgniteJsx(ctx.root, view("b"), tree, { hosts: ctx.hosts });
		expect(ctx.rec.dispose).toBe(1);
		expect(other.mount).toBe(0);
	});
	it("a mount that sends and settles after the flush still delivers", async () => {
		const ctx = run(() => ({}));
		const log: string[] = [];
		const host = {
			select: (n: unknown) => n,
			mount: (_el: Element, hostCtx: { send(event: unknown): void }) => {
				hostCtx.send("x");
				return new Promise((resolve) => setTimeout(() => resolve({}), 15));
			},
			update: () => void log.push("update"),
			dispose: () => undefined,
		};
		ctx.hosts.send = () => void log.push("send");
		ctx.hosts.hosts.scene = host as never;
		renderIgniteJsx(
			ctx.root,
			jsx("div", { children: jsx("canvas", { use: "scene" }) }),
			undefined,
			{ hosts: ctx.hosts },
		);
		await new Promise((resolve) => setTimeout(resolve, 40));
		expect(log).toEqual(["send", "update"]);
	});
	it("a host element getAttribute that supersedes stops the aria write", () => {
		const ctx = run(() => ({}));
		let seen: Element | undefined;
		let trig = false;
		customElements.define(
			"x-r16-attr",
			class extends HTMLElement {
				getAttribute(name: string) {
					if (trig && name === "aria-describedby") {
						trig = false;
						seen = this;
						ctx.supersede();
					}
					return super.getAttribute(name);
				}
			},
		);
		ctx.hosts.hosts.scene = hostFor(ctx.rec, {}) as never;
		trig = true;
		renderIgniteJsx(
			ctx.root,
			jsx("div", { children: jsx("x-r16-attr", { use: "scene" }) }),
			undefined,
			{ hosts: ctx.hosts },
		);
		expect(seen).toBeDefined();
		expect(seen?.hasAttribute("aria-describedby")).toBe(false);
	});
	it("a getAttribute that supersedes during the cleanup leaves the new description", () => {
		const ctx = run(() => ({}));
		let trig = false;
		let tree1: ReturnType<typeof renderIgniteJsx>;
		const view = (use?: string) =>
			jsx("div", { children: jsx("x-r17-clear", { use }) });
		customElements.define(
			"x-r17-clear",
			class extends HTMLElement {
				getAttribute(name: string) {
					if (trig && name === "aria-describedby") {
						trig = false;
						renderIgniteJsx(ctx.root, view("scene"), tree1, {
							hosts: ctx.hosts,
						});
					}
					return super.getAttribute(name);
				}
			},
		);
		ctx.hosts.hosts.scene = hostFor(ctx.rec, {}) as never;
		tree1 = renderIgniteJsx(ctx.root, view("scene"), undefined, {
			hosts: ctx.hosts,
		});
		const el = ctx.root.querySelector("x-r17-clear") as Element;
		expect(el.hasAttribute("aria-describedby")).toBe(true);
		trig = true;
		renderIgniteJsx(ctx.root, view(), tree1, { hosts: ctx.hosts });
		const now = ctx.root.querySelector("x-r17-clear") as Element;
		const node = now.querySelector("[data-ignite-host-description]");
		expect(node).not.toBeNull();
		expect(now.getAttribute("aria-describedby")).toContain(
			(node as Element).id,
		);
	});
	it("a getAttribute that supersedes while an id is forgotten writes nothing stale", () => {
		const ctx = run(() => ({}));
		let trig = false;
		let seen: Element | undefined;
		customElements.define(
			"x-r17-forget",
			class extends HTMLElement {
				getAttribute(name: string) {
					if (trig && name === "aria-describedby") {
						trig = false;
						seen = this;
						ctx.supersede();
					}
					return super.getAttribute(name);
				}
			},
		);
		ctx.hosts.hosts.scene = hostFor(ctx.rec, {}) as never;
		const view = () =>
			jsx("div", { children: jsx("x-r17-forget", { use: "scene" }) });
		const tree1 = renderIgniteJsx(ctx.root, view(), undefined, {
			hosts: ctx.hosts,
		});
		const el = ctx.root.querySelector("x-r17-forget") as Element;
		const id = el.querySelector("[data-ignite-host-description]")?.id ?? "";
		// Another element takes the id and the description node goes away, so the
		// next description forgets the old id.
		el.querySelector("[data-ignite-host-description]")?.remove();
		const squatter = document.createElement("i");
		squatter.id = id;
		document.body.append(squatter);
		trig = true;
		renderIgniteJsx(ctx.root, view(), tree1, { hosts: ctx.hosts });
		expect(seen).toBeDefined();
		expect(seen?.getAttribute("aria-describedby")).toBe(id);
	});
	it("an abort listener that supersedes still stops motion watching and disposes in order", () => {
		const removed: string[] = [];
		vi.stubGlobal("matchMedia", () => ({
			addEventListener: () => undefined,
			removeEventListener: () => void removed.push("motion"),
		}));
		try {
			const ctx = run(() => ({}));
			const log: string[] = [];
			const host = hostFor(ctx.rec, {});
			(host as { mount: unknown }).mount = (
				el: Element,
				hostCtx: { signal: AbortSignal },
			) => {
				el.append(document.createElement("span"));
				hostCtx.signal.addEventListener("abort", () => {
					log.push("abort");
					ctx.supersede();
				});
				return {};
			};
			host.dispose = () =>
				void log.push(`dispose after ${removed.length} motion stop`);
			ctx.hosts.hosts.scene = host as never;
			const tree = renderIgniteJsx(
				ctx.root,
				jsx("div", { children: jsx("canvas", { use: "scene" }) }),
				undefined,
				{ hosts: ctx.hosts },
			);
			renderIgniteJsx(ctx.root, jsx("div", {}), tree, { hosts: ctx.hosts });
			expect(log).toEqual(["abort", "dispose after 1 motion stop"]);
		} finally {
			vi.unstubAllGlobals();
		}
	});
	it("a children getter that supersedes during the cleanup leaves the new description", () => {
		const ctx = run(() => ({}));
		let trig = false;
		let tree1: ReturnType<typeof renderIgniteJsx>;
		const view = (use?: string) =>
			jsx("div", { children: jsx("x-r18-children", { use }) });
		customElements.define(
			"x-r18-children",
			class extends HTMLElement {
				get children() {
					if (trig) {
						trig = false;
						renderIgniteJsx(ctx.root, view("scene"), tree1, {
							hosts: ctx.hosts,
						});
					}
					return super.children;
				}
			},
		);
		ctx.hosts.hosts.scene = hostFor(ctx.rec, {}) as never;
		tree1 = renderIgniteJsx(ctx.root, view("scene"), undefined, {
			hosts: ctx.hosts,
		});
		trig = true;
		renderIgniteJsx(ctx.root, view(), tree1, { hosts: ctx.hosts });
		const now = ctx.root.querySelector("x-r18-children") as Element;
		const node = now.querySelector("[data-ignite-host-description]");
		expect(node).not.toBeNull();
		expect(now.getAttribute("aria-describedby")).toContain(
			(node as Element).id,
		);
	});
	it("a thenable whose then accessor supersedes stops the description work", () => {
		const ctx = run(() => ({}));
		let trig = false;
		const host = hostFor(ctx.rec, {});
		(host as { mount: unknown }).mount = () => ({
			get then() {
				if (trig) {
					trig = false;
					ctx.supersede();
				}
				return (resolve: (value: unknown) => void) => resolve({});
			},
		});
		ctx.hosts.hosts.scene = host as never;
		trig = true;
		renderIgniteJsx(
			ctx.root,
			jsx("div", { children: jsx("canvas", { use: "scene" }) }),
			undefined,
			{ hosts: ctx.hosts },
		);
		expect(ctx.rec.describe ?? 0).toBe(0);
	});
});
