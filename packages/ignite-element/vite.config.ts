import { lstatSync, rmSync } from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import { createLibConfig } from "../../configs/vite/lib";

// Private package import. Node, Vite, and esbuild resolve it to the
// renderer's read seam. It is not a package export of ignite-element.
const authorReaderId = "#author-style";

function removeWorkspaceRendererLink(): void {
	const linkPath = path.resolve(process.cwd(), "../@ignite-element/renderer");
	try {
		if (!lstatSync(linkPath).isSymbolicLink()) return;
	} catch {
		return;
	}
	rmSync(linkPath, { force: true });
}

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

const devArtifact = process.env.IGNITE_LIB_DEV === "1";

export default defineConfig(({ command }) => {
	const libConfig = createLibConfig({
		devArtifact: command === "build" && devArtifact,
		name: "ignite-element",
		entry: {
			index: "src/index.ts",
			xstate: "src/xstate.ts",
			redux: "src/redux.ts",
			mobx: "src/mobx.ts",
			"actor-web": "src/actor-web.ts",
			"actor-web/web": "src/actor-web/web.ts",
			"renderers/ignite-jsx": "src/renderers/ignite-jsx.ts",
			"renderers/lit": "src/renderers/lit.ts",
			"config/loadIgniteConfig": "src/config/loadIgniteConfig.ts",
			"config/webpack": "src/config/webpack.ts",
			"config/vite": "src/config/vite.ts",
			"jsx/index": "src/jsx/index.ts",
			"jsx/jsx-runtime": "src/jsx/jsx-runtime.ts",
			"jsx/jsx-dev-runtime": "src/jsx/jsx-dev-runtime.ts",
			react: "src/react/index.ts",
			"react/web": "src/react/web.ts",
			tools: "src/tools/index.ts",
			"tools/anthropic": "src/tools/anthropic/index.ts",
			"tools/openai": "src/tools/openai/index.ts",
		},
		external: [
			"@ignite-element/core",
			"@ignite-element/renderer",
			authorReaderId,
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
	});
	const warningsOn = command !== "build" || devArtifact;
	removeWorkspaceRendererLink();
	return {
		...libConfig,
		define: {
			...libConfig.define,
			"process.env.NODE_ENV": JSON.stringify(resolveNodeEnv(command)),
			__IGNITE_DEV_WARNINGS__: JSON.stringify(warningsOn),
			__IGNITE_HOST_RUNTIME__: JSON.stringify(true),
		},
		plugins: [
			{
				name: "externalize-author-style",
				apply: "build",
				enforce: "pre",
				buildStart() {
					removeWorkspaceRendererLink();
				},
				resolveId(source, importer) {
					if (!importer) return null;
					if (
						source === "@ignite-element/renderer/jsx/author-style" ||
						/(?:^|\/)authorStyle(?:\.ts|\.js)?$/.test(source) ||
						/(?:^|\/)author-style-mark(?:\.development)?\.es\.js$/.test(source)
					) {
						return {
							id: authorReaderId,
							external: true,
						};
					}
					return null;
				},
			} satisfies Plugin,
			...(libConfig.plugins ?? []),
		],
	};
});
