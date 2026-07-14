import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin, type UserConfig } from "vite";
import {
	runBraveWebSearch,
	type BraveWebSearchOptions,
} from "./server/brave-web-search";

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

const routeFailure = (
	type: "validation" | "provider-failure",
	message: string,
) => ({
	type,
	ownerId: "voice-workbench-server",
	toolName: "searchWeb",
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
				"provider-failure",
				"The web search route accepts POST requests only.",
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
				...routeFailure("validation", "The web search request is invalid."),
				issues: ["body: expected JSON"],
			},
		};
	}
	return {
		status: 200,
		body: await runBraveWebSearch(
			{ name: "searchWeb", input },
			options,
		),
	};
}

const readBody = async (
	request: AsyncIterable<unknown>,
): Promise<string | null> => {
	try {
		const chunks: Uint8Array[] = [];
		for await (const chunk of request) {
			if (typeof chunk === "string") chunks.push(Buffer.from(chunk));
			else if (chunk instanceof Uint8Array) chunks.push(chunk);
			else return null;
		}
		return Buffer.concat(chunks).toString("utf8");
	} catch {
		return null;
	}
};

const capabilityPlugin = (options: VoiceWorkbenchViteOptions): Plugin => ({
	name: "voice-workbench-capabilities",
	configureServer(server) {
		server.middlewares.use(
			"/api/capabilities/web-search",
			async (request, response) => {
				const body = await readBody(request);
				const result =
					body === null
						? {
								status: 400,
								body: routeFailure(
									"validation",
									"The web search request could not be read.",
								),
							}
						: await handleWebSearchCapabilityRequest(
								{ method: request.method, body },
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

export default defineConfig(
	createVoiceWorkbenchViteConfig({
		braveSearchApiKey: process.env.BRAVE_SEARCH_API_KEY,
	}),
);
