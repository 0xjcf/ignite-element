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

export type PluginContextStub = MinimalPluginContextWithoutEnvironment & {
	addWatchFile: (id: string) => void;
	cache: {
		delete: (id: string) => void;
		get: <T = unknown>(id: string) => T | undefined;
		has: (id: string) => boolean;
		set: <T = unknown>(id: string, value: T) => void;
	};
	emitFile: (options: { type: "asset"; name?: string }) => string;
	fs: unknown;
	getFileName: (referenceId: string) => string;
	getModuleIds: () => IterableIterator<string>;
	getModuleInfo: (id?: string) => null;
	getWatchFiles: () => string[];
	load: (id: string) => Promise<unknown>;
	parse: (code: string) => unknown;
	resolve: (id: string) => Promise<unknown>;
	setAssetSource: (referenceId: string, source: string | Uint8Array) => void;
};

/* c8 ignore start */
let assetCounter = 0;
const emittedAssets = new Map<string, string | Uint8Array | null>();

const pluginContext: PluginContextStub = Object.assign(minimalPluginContext, {
	addWatchFile: (_id: string) => undefined,
	cache: {
		delete: (_id: string) => undefined,
		get: (_id: string) => undefined,
		has: (_id: string) => false,
		set: (_id: string, _value: unknown) => undefined,
	},
	emitFile: ({ type }: { type: "asset"; name?: string }) => {
		if (type !== "asset") {
			throw new Error("Only asset emission is supported in tests.");
		}

		const referenceId = `asset-${++assetCounter}`;
		emittedAssets.set(referenceId, null);
		return referenceId;
	},
	fs: {},
	getFileName: (referenceId: string) => {
		if (!emittedAssets.has(referenceId)) {
			throw new Error(
				`Unknown reference id "${referenceId}". Did you call emitFile first?`,
			);
		}
		return `${referenceId}.js`;
	},
	getModuleIds: function* () {
		// Yield from an empty iterable to satisfy generator requirements without producing items.
		yield* new Set<string>().values();
	},
	getModuleInfo: () => null,
	getWatchFiles: () => [],
	load: async (_id: string) => ({ ast: null, code: null }),
	parse: (_code: string) => ({ type: "Program" }),
	resolve: async (_id: string) => null,
	setAssetSource: (referenceId: string, source: string | Uint8Array) => {
		if (!emittedAssets.has(referenceId)) {
			throw new Error(
				`Unknown reference id "${referenceId}". Did you call emitFile first?`,
			);
		}
		emittedAssets.set(referenceId, source);
	},
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
