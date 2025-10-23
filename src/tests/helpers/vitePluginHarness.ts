import type {
	HtmlTagDescriptor,
	IndexHtmlTransform,
	IndexHtmlTransformContext,
	IndexHtmlTransformHook,
	MinimalPluginContextWithoutEnvironment,
	ResolvedConfig,
	Plugin as VitePlugin,
} from "vite";

/* c8 ignore start */
const noop = () => {};

const minimalPluginContext: MinimalPluginContextWithoutEnvironment = {
	debug: noop,
	info: noop,
	warn: noop,
	error(error) {
		throw typeof error === "string" ? new Error(error) : error;
	},
	meta: { rollupVersion: "test", watchMode: false, viteVersion: "test" },
};

type PluginContextStub = MinimalPluginContextWithoutEnvironment & {
	addWatchFile: typeof noop;
	cache: {
		delete: typeof noop;
		get: () => unknown;
		has: () => boolean;
		set: typeof noop;
	};
	emitFile: () => string;
	fs: unknown;
	getFileName: () => string;
	getModuleIds: () => IterableIterator<string>;
	getModuleInfo: () => null;
	getWatchFiles: () => string[];
	load: () => Promise<unknown>;
	parse: () => unknown;
	resolve: () => Promise<unknown>;
	setAssetSource: typeof noop;
};

/* c8 ignore start */
const pluginContext: PluginContextStub = Object.assign(minimalPluginContext, {
	addWatchFile: noop,
	cache: {
		delete: noop,
		get: () => undefined,
		has: () => false,
		set: noop,
	},
	emitFile: () => "",
	fs: {},
	getFileName: () => "",
	getModuleIds: function* () {
		// Yield from an empty iterable to satisfy generator requirements without producing items.
		yield* new Set<string>().values();
	},
	getModuleInfo: () => null,
	getWatchFiles: () => [],
	load: async () => ({ ast: null, code: null }),
	parse: () => ({ type: "Program" }),
	resolve: async () => null,
	setAssetSource: noop,
});
/* c8 ignore end */

export function runIndexHtml(
	hook: IndexHtmlTransform | undefined,
	html = "<html></html>",
): HtmlTagDescriptor[] | undefined {
	if (!hook) {
		return undefined;
	}

	const context: IndexHtmlTransformContext = {
		path: html,
		filename: html,
	};
	const handler = (
		typeof hook === "function" ? hook : hook.handler
	) as IndexHtmlTransformHook;
	const result = handler.call(minimalPluginContext, html, context);

	if (result === undefined) {
		return undefined;
	}

	if (Array.isArray(result)) {
		return result;
	}

	if (typeof result === "string") {
		return [
			{
				tag: "script",
				attrs: {},
				children: result,
			},
		];
	}

	if (typeof result === "object" && result && "tags" in result) {
		return (result as { tags: HtmlTagDescriptor[] }).tags;
	}

	/* c8 ignore next */
	return undefined;
}

export const runResolveId = (hook: VitePlugin["resolveId"], id: string) => {
	if (!hook) {
		return undefined;
	}

	const raw = typeof hook === "function" ? hook : hook.handler;
	const handler = raw as unknown as (
		this: PluginContextStub,
		source: string,
		importer: string | undefined,
		options: { attributes: Record<string, string>; isEntry: boolean },
	) => unknown;

	return handler.call(pluginContext, id, undefined, {
		attributes: {},
		isEntry: false,
	});
};

export const runLoad = (hook: VitePlugin["load"], id: string) => {
	if (!hook) {
		return undefined;
	}

	const raw = typeof hook === "function" ? hook : hook.handler;
	const handler = raw as unknown as (
		this: PluginContextStub,
		id: string,
	) => unknown;

	return handler.call(pluginContext, id);
};

export const runConfigResolved = (
	hook: VitePlugin["configResolved"],
	config: ResolvedConfig,
): void => {
	if (!hook) {
		return;
	}

	const handler = (typeof hook === "function" ? hook : hook.handler) as (
		this: MinimalPluginContextWithoutEnvironment,
		config: ResolvedConfig,
	) => void;

	handler.call(minimalPluginContext, config);
};

export { minimalPluginContext };
