import { createActorWebHomeSession } from "./actor-web-home";
import { openAICompatibleModel } from "./model";
import { startSmartHomeBridgeServer } from "./server";

const baseUrl =
	process.env.MLX_BASE_URL ??
	process.env.OPENAI_COMPAT_BASE_URL ??
	"http://127.0.0.1:8080/v1";
const model =
	process.env.MLX_MODEL ?? process.env.OPENAI_COMPAT_MODEL ?? "mlx-local";
const apiKey = process.env.OPENAI_COMPAT_API_KEY ?? process.env.OPENAI_API_KEY;
const runtimeFactory =
	process.env.SMART_HOME_RUNTIME === "actor-web"
		? createActorWebHomeSession
		: undefined;

const server = await startSmartHomeBridgeServer({
	terminal: true,
	openAIModel: openAICompatibleModel({ baseUrl, model, apiKey }),
	runtimeFactory,
});

console.log(
	`Smart-home MLX bridge listening on http://localhost:${server.port}`,
);
console.log(`OpenAI-compatible endpoint: ${baseUrl}`);
console.log(`Model: ${model}`);
