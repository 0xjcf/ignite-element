import type {
	HtmlTagDescriptor,
	ResolvedConfig,
	Plugin as VitePlugin,
} from "vite";
import { describe, expect, it } from "vitest";
import type { PluginContextStub } from "./vitePluginHarness";
import {
	minimalPluginContext,
	runConfigResolved,
	runIndexHtml,
	runLoad,
	runResolveId,
} from "./vitePluginHarness";

const sampleTags: HtmlTagDescriptor[] = [
	{ tag: "script", attrs: {}, children: "console.log('hi');" },
];

describe("vitePluginHarness", () => {
	it("runIndexHtml handles function hooks", () => {
		const hook = () => sampleTags;

		const result = runIndexHtml(hook);
		expect(result).toEqual(sampleTags);
	});

	it("runIndexHtml handles handler objects", () => {
		const hook = {
			handler() {
				return { html: "", tags: sampleTags };
			},
		};

		const result = runIndexHtml(hook);
		expect(result).toEqual(sampleTags);
	});

	it("runIndexHtml converts string results", () => {
		const hook = () => "console.log('inline');";

		const result = runIndexHtml(hook);
		expect(result).toEqual([
			{
				tag: "script",
				attrs: {},
				children: "console.log('inline');",
			},
		]);
	});

	it("runIndexHtml returns undefined when hook missing", () => {
		expect(runIndexHtml(undefined)).toBeUndefined();
	});

	it("runIndexHtml returns undefined when handler returns void", () => {
		const hook = () => undefined;

		expect(runIndexHtml(hook)).toBeUndefined();
	});

	it("runIndexHtml returns undefined for objects without tags", () => {
		const hook = () => ({}) as HtmlTagDescriptor[] | undefined;

		expect(runIndexHtml(hook)).toBeUndefined();
	});

	it("runIndexHtml handles null results", () => {
		const hook = () => null as unknown as HtmlTagDescriptor[];

		expect(runIndexHtml(hook)).toBeUndefined();
	});

	it("runResolveId handles function hooks", () => {
		const hook: VitePlugin["resolveId"] = (id) => {
			expect(id).toBe("entry");
			return "resolved";
		};

		const result = runResolveId(hook, "entry");
		expect(result).toBe("resolved");
	});

	it("runResolveId handles handler objects", () => {
		const hook: VitePlugin["resolveId"] = {
			handler(id) {
				expect(id).toBe("entry");
				return null;
			},
		};

		expect(runResolveId(hook, "entry")).toBeNull();
	});

	it("runResolveId returns undefined for missing hook", () => {
		expect(runResolveId(undefined, "entry")).toBeUndefined();
	});

	it("runLoad handles function hooks", () => {
		const hook: VitePlugin["load"] = () => "code";

		expect(runLoad(hook, "id")).toBe("code");
	});

	it("runLoad handles handler objects", () => {
		const hook: VitePlugin["load"] = {
			handler() {
				return null;
			},
		};

		expect(runLoad(hook, "id")).toBeNull();
	});

	it("runLoad returns undefined for missing hook", () => {
		expect(runLoad(undefined, "id")).toBeUndefined();
	});

	it("runLoad returns undefined when handler returns void", () => {
		const hook: VitePlugin["load"] = () => undefined;

		expect(runLoad(hook, "id")).toBeUndefined();
	});

	it("runConfigResolved handles function hooks", () => {
		const hook: VitePlugin["configResolved"] = function (
			this: typeof minimalPluginContext,
			config,
		) {
			expect(this).toBe(minimalPluginContext);
			expect(config.root).toBe("/tmp");
		};

		expect(() =>
			runConfigResolved(hook, { root: "/tmp" } as ResolvedConfig),
		).not.toThrow();
	});

	it("runConfigResolved handles handler objects", () => {
		const hook: VitePlugin["configResolved"] = {
			handler(this: typeof minimalPluginContext, config) {
				expect(this).toBe(minimalPluginContext);
				expect(config.root).toBe("/tmp");
			},
		};

		expect(() =>
			runConfigResolved(hook, { root: "/tmp" } as ResolvedConfig),
		).not.toThrow();
	});

	it("runConfigResolved tolerates missing hook", () => {
		expect(() =>
			runConfigResolved(undefined, { root: "/tmp" } as ResolvedConfig),
		).not.toThrow();
	});

	it("runResolveId exposes plugin context helpers", async () => {
		const hook = async function (this: PluginContextStub, id: string) {
			expect(this.meta.viteVersion).toBe("test");
			this.debug("debug message");
			this.info("info message");
			this.warn("warn message");

			this.addWatchFile("virtual:id");
			this.cache.delete("virtual:id");
			this.cache.get("virtual:id");
			this.cache.has("virtual:id");
			this.cache.set("virtual:id", "value");
			this.emitFile();
			this.getFileName();
			[...this.getModuleIds()];
			this.getModuleInfo("virtual:id");
			this.getWatchFiles();

			const loadResult = await this.load(id);
			expect(loadResult).toEqual({ ast: null, code: null });

			this.parse(id);

			const resolved = await this.resolve(id);
			expect(resolved).toBeNull();

			this.setAssetSource(id, "source");

			return "handled";
		} as unknown as VitePlugin["resolveId"];

		await expect(runResolveId(hook, "entry")).resolves.toBe("handled");
	});

	it("minimalPluginContext.error wraps string errors", () => {
		expect(() => minimalPluginContext.error("boom")).toThrowError("boom");
	});

	it("minimalPluginContext.error rethrows error objects", () => {
		const error = new Error("kapow");
		expect(() => minimalPluginContext.error(error)).toThrow(error);
	});
});
