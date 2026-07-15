import { fileURLToPath } from "node:url";
import {
	type ConfigEnv,
	defineConfig,
	loadEnv,
	type Plugin,
	type UserConfig,
} from "vite";
import {
	type BraveWebSearchOptions,
	runBraveWebSearch,
} from "./server/brave-web-search";
import { runWholeFoodsProductPricing } from "./server/product-pricing/whole-foods";

const resolvePath = (path: string) =>
	fileURLToPath(new URL(path, import.meta.url));

const igniteElementSourceRoot = resolvePath(
	"../../../packages/ignite-element/src/",
);
const adaptersSourceRoot = resolvePath("../../../packages/ignite-adapters/src");
const rendererSourceRoot = resolvePath("../../../packages/ignite-renderer/src");

type CapabilityRouteRequest = {
	method?: string;
	body: string;
};

type CapabilityRouteResponse = {
	status: number;
	body: unknown;
};

type VoiceWorkbenchViteOptions = {
	braveSearchApiKey?: string;
	fetch?: BraveWebSearchOptions["fetch"];
};

type VoiceWorkbenchServerEnvironmentOptions = {
	envDir?: string;
	processEnv?: Readonly<Record<string, string | undefined>>;
};

export const resolveVoiceWorkbenchServerEnvironment = (
	environment: Pick<ConfigEnv, "mode">,
	options: VoiceWorkbenchServerEnvironmentOptions = {},
): Pick<VoiceWorkbenchViteOptions, "braveSearchApiKey"> => {
	const loadedEnv = loadEnv(
		environment.mode,
		options.envDir ?? resolvePath("./"),
		"BRAVE_SEARCH_",
	);
	const processEnv = options.processEnv ?? process.env;
	return {
		braveSearchApiKey:
			processEnv.BRAVE_SEARCH_API_KEY ?? loadedEnv.BRAVE_SEARCH_API_KEY,
	};
};

export const MAX_CAPABILITY_REQUEST_BYTES = 16_384;

const routeFailure = (
	toolName: "searchWeb" | "priceProducts",
	type: "validation" | "provider-failure",
	message: string,
) => ({
	type,
	ownerId: "voice-workbench-server",
	toolName,
	message,
});

export async function handleWebSearchCapabilityRequest(
	request: CapabilityRouteRequest,
	options: BraveWebSearchOptions,
): Promise<CapabilityRouteResponse> {
	if (request.method !== "POST") {
		return {
			status: 405,
			body: routeFailure(
				"searchWeb",
				"provider-failure",
				"The web search route accepts POST requests only.",
			),
		};
	}
	if (Buffer.byteLength(request.body, "utf8") > MAX_CAPABILITY_REQUEST_BYTES) {
		return {
			status: 413,
			body: routeFailure(
				"searchWeb",
				"validation",
				"The web search request is too large.",
			),
		};
	}
	let input: unknown;
	try {
		input = JSON.parse(request.body);
	} catch {
		return {
			status: 400,
			body: {
				...routeFailure(
					"searchWeb",
					"validation",
					"The web search request is invalid.",
				),
				issues: ["body: expected JSON"],
			},
		};
	}
	return {
		status: 200,
		body: await runBraveWebSearch({ name: "searchWeb", input }, options),
	};
}

export async function handleProductPricingCapabilityRequest(
	request: CapabilityRouteRequest,
	options: VoiceWorkbenchViteOptions,
): Promise<CapabilityRouteResponse> {
	if (request.method !== "POST") {
		return {
			status: 405,
			body: routeFailure(
				"priceProducts",
				"provider-failure",
				"The product-pricing route accepts POST requests only.",
			),
		};
	}
	if (Buffer.byteLength(request.body, "utf8") > MAX_CAPABILITY_REQUEST_BYTES) {
		return {
			status: 413,
			body: routeFailure(
				"priceProducts",
				"validation",
				"The product-pricing request is too large.",
			),
		};
	}
	let input: unknown;
	try {
		input = JSON.parse(request.body);
	} catch {
		return {
			status: 400,
			body: {
				...routeFailure(
					"priceProducts",
					"validation",
					"The product-pricing request is invalid.",
				),
				issues: ["body: expected JSON"],
			},
		};
	}
	return {
		status: 200,
		body: await runWholeFoodsProductPricing(
			{ name: "priceProducts", input },
			{
				apiKey: options.braveSearchApiKey,
				fetch: options.fetch,
			},
		),
	};
}

export const readCapabilityRequestBody = async (
	request: AsyncIterable<unknown>,
): Promise<
	{ ok: true; body: string } | { ok: false; reason: "invalid" | "too-large" }
> => {
	try {
		const chunks: Uint8Array[] = [];
		let totalBytes = 0;
		for await (const chunk of request) {
			const byteLength =
				typeof chunk === "string"
					? Buffer.byteLength(chunk, "utf8")
					: chunk instanceof Uint8Array
						? chunk.byteLength
						: null;
			if (byteLength === null) return { ok: false, reason: "invalid" };
			totalBytes += byteLength;
			if (totalBytes > MAX_CAPABILITY_REQUEST_BYTES) {
				return { ok: false, reason: "too-large" };
			}
			chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
		}
		return { ok: true, body: Buffer.concat(chunks).toString("utf8") };
	} catch {
		return { ok: false, reason: "invalid" };
	}
};

const capabilityPlugin = (options: VoiceWorkbenchViteOptions): Plugin => ({
	name: "voice-workbench-capabilities",
	configureServer(server) {
		server.middlewares.use(
			"/api/capabilities/web-search",
			async (request, response) => {
				const body = await readCapabilityRequestBody(request);
				const result = !body.ok
					? {
							status: body.reason === "too-large" ? 413 : 400,
							body: routeFailure(
								"searchWeb",
								"validation",
								body.reason === "too-large"
									? "The web search request is too large."
									: "The web search request could not be read.",
							),
						}
					: await handleWebSearchCapabilityRequest(
							{ method: request.method, body: body.body },
							{
								apiKey: options.braveSearchApiKey,
								fetch: options.fetch,
							},
						);
				response.statusCode = result.status;
				response.setHeader("content-type", "application/json; charset=utf-8");
				response.end(JSON.stringify(result.body));
			},
		);
		server.middlewares.use(
			"/api/capabilities/product-pricing",
			async (request, response) => {
				const body = await readCapabilityRequestBody(request);
				const result = !body.ok
					? {
							status: body.reason === "too-large" ? 413 : 400,
							body: routeFailure(
								"priceProducts",
								"validation",
								body.reason === "too-large"
									? "The product-pricing request is too large."
									: "The product-pricing request could not be read.",
							),
						}
					: await handleProductPricingCapabilityRequest(
							{ method: request.method, body: body.body },
							options,
						);
				response.statusCode = result.status;
				response.setHeader("content-type", "application/json; charset=utf-8");
				response.end(JSON.stringify(result.body));
			},
		);
	},
});

export const createVoiceWorkbenchViteConfig = (
	options: VoiceWorkbenchViteOptions = {},
): UserConfig => ({
	define: {
		__VOICE_WORKBENCH_WEB_SEARCH_AVAILABLE__: JSON.stringify(
			Boolean(options.braveSearchApiKey?.trim()),
		),
	},
	plugins: [capabilityPlugin(options)],
	build: {
		rollupOptions: {
			input: {
				main: resolvePath("./index.html"),
				parity: resolvePath("./parity.html"),
			},
		},
	},
	test: { environment: "node" },
	resolve: {
		alias: [
			{
				find: "@ignite-element/core",
				replacement: resolvePath("../../../packages/ignite-core/src/index.ts"),
			},
			{
				find: "@ignite-element/adapters/xstate",
				replacement: `${adaptersSourceRoot}/xstate.ts`,
			},
			{
				find: "@ignite-element/adapters",
				replacement: `${adaptersSourceRoot}/index.ts`,
			},
			{
				find: "@ignite-element/renderer/jsx-runtime",
				replacement: `${rendererSourceRoot}/jsx/jsx-runtime.ts`,
			},
			{
				find: "@ignite-element/renderer/jsx-dev-runtime",
				replacement: `${rendererSourceRoot}/jsx/jsx-dev-runtime.ts`,
			},
			{
				find: "@ignite-element/renderer/jsx",
				replacement: `${rendererSourceRoot}/renderers/ignite-jsx.ts`,
			},
			{
				find: "@ignite-element/renderer",
				replacement: `${rendererSourceRoot}/index.ts`,
			},
			{
				find: /^ignite-element\/(.+)$/,
				replacement: `${igniteElementSourceRoot}$1`,
			},
			{
				find: "ignite-element",
				replacement: resolvePath(
					"../../../packages/ignite-element/src/index.ts",
				),
			},
		],
	},
});

export default defineConfig((environment) =>
	createVoiceWorkbenchViteConfig(
		resolveVoiceWorkbenchServerEnvironment(environment),
	),
);
