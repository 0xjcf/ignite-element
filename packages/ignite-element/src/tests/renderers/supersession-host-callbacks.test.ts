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
			host.mount = (el: Element, hostCtx: { send(event: unknown): void }) => {
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
});
