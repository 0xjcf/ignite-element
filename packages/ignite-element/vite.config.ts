import { defineConfig } from "vite";
import { createLibConfig } from "../../configs/vite/lib";

type ViteCommand = "build" | "serve";

const resolveNodeEnv = (
	command: ViteCommand,
	explicitNodeEnv = process.env.NODE_ENV,
): "production" | "development" => {
	const semanticNodeEnv = command === "build" ? "production" : "development";
	return explicitNodeEnv === semanticNodeEnv
		? explicitNodeEnv
		: semanticNodeEnv;
};

export default defineConfig(({ command }) => ({
	...createLibConfig({
		name: "ignite-element",
		entry: {
			index: "src/index.ts",
			xstate: "src/xstate.ts",
			redux: "src/redux.ts",
			mobx: "src/mobx.ts",
			"actor-web": "src/actor-web.ts",
			"renderers/ignite-jsx": "src/renderers/ignite-jsx.ts",
			"renderers/lit": "src/renderers/lit.ts",
			"config/loadIgniteConfig": "src/config/loadIgniteConfig.ts",
			"config/webpack": "src/config/webpack.ts",
			"config/vite": "src/config/vite.ts",
			"jsx/index": "src/jsx/index.ts",
			"jsx/jsx-runtime": "src/jsx/jsx-runtime.ts",
			"jsx/jsx-dev-runtime": "src/jsx/jsx-dev-runtime.ts",
			react: "src/react/index.ts",
			tools: "src/tools/index.ts",
			"tools/anthropic": "src/tools/anthropic/index.ts",
			"tools/openai": "src/tools/openai/index.ts",
		},
		external: [
			"@ignite-element/core",
			"@ignite-element/renderer",
			"@ignite-element/adapters",
			"@ignite-element/adapters/actor-web",
			"lit-html",
			"xstate",
			"mobx",
			"redux",
			"@reduxjs/toolkit",
			"react",
			"react-dom",
			"react/jsx-runtime",
			"node:fs",
			"node:path",
			"node:url",
		],
		globals: {
			xstate: "XState",
			redux: "Redux",
			mobx: "MobX",
			"@ignite-element/adapters/actor-web": "IgniteAdaptersActorWeb",
			"lit-html": "LitHTML",
			"@reduxjs/toolkit": "RTK",
		},
	}),
	define: {
		"process.env.NODE_ENV": JSON.stringify(resolveNodeEnv(command)),
	},
}));
