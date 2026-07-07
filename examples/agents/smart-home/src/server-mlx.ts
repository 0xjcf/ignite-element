import { resolveSmartHomeRuntimeFactory } from "./cli";
import { runSmartHomeBridgeCli } from "./lifecycle";
import { openAICompatibleModel } from "./model";
import { startSmartHomeBridgeServer } from "./server";

const defaultBaseUrl = "http://127.0.0.1:8080/v1";
const baseUrl =
	process.env.MLX_BASE_URL ??
	process.env.OPENAI_COMPAT_BASE_URL ??
	defaultBaseUrl;
const model =
	process.env.MLX_MODEL ?? process.env.OPENAI_COMPAT_MODEL ?? "mlx-local";
const apiKey = process.env.OPENAI_COMPAT_API_KEY;
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
