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
});
