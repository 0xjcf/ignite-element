import {
	resolveMlxConnectionOptions,
	resolveSmartHomeRuntimeFactory,
} from "./cli";
import { runSmartHomeBridgeCli } from "./lifecycle";
import { openAICompatibleModel } from "./model";
import { startSmartHomeBridgeServer } from "./server";

const { baseUrl, model, apiKey } = resolveMlxConnectionOptions();
const runtimeFactory = resolveSmartHomeRuntimeFactory();

await runSmartHomeBridgeCli({
	displayName: "Smart-home MLX bridge",
	start: () =>
		startSmartHomeBridgeServer({
			terminal: true,
			openAIModel: openAICompatibleModel({ baseUrl, model, apiKey }),
			runtimeFactory,
		}),
	onStarted: (server) => {
		console.log(
			`Smart-home MLX bridge listening on http://localhost:${server.port}`,
		);
		console.log(`OpenAI-compatible endpoint: ${baseUrl}`);
		console.log(`Model: ${model}`);
	},
});
