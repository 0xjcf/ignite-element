import type {
	HtmlTagDescriptor,
	ResolvedConfig,
	Plugin as VitePlugin,
} from "vite";
import { describe, expect, it } from "vitest";
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
});
