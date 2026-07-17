/// <reference types="vite/client" />
import { createProjectionDocumentTarget } from "ignite-element/xstate";
import { createBrowserSpeechDeliveryPort } from "./adapters/browser-speech";
import { createBrowserVoiceCapturePort } from "./adapters/browser-voice";
import { createWorkbenchModelTurnPort } from "./adapters/mlx-model-turn";
import {
	createProductPriceCapability,
	createProductPricingDomainPack,
} from "./domains/product-pricing";
import { createDomainRegistry } from "./domains/registry";
import { probeMlxWorkbenchReadiness } from "./model";
import { createVoiceWorkbenchSessionActor } from "./session";
import { createWebSearchCapability } from "./web-search-capability";
import { renderWorkbench } from "./workbench";
import { createVoiceWorkbenchComponent } from "./workbench-component";
import { createVoiceWorkbenchRuntime } from "./workbench-runtime";

declare const __VOICE_WORKBENCH_WEB_SEARCH_AVAILABLE__: boolean;

type RuntimeConfiguration = {
	MLX_BASE_URL?: string;
	MLX_MODEL?: string;
	MLX_API_KEY?: string;
};

const runtimeConfiguration = globalThis as typeof globalThis &
	RuntimeConfiguration;
const environment = import.meta.env as ImportMetaEnv & RuntimeConfiguration;
const configuration = {
	baseUrl:
		runtimeConfiguration.MLX_BASE_URL ??
		environment.MLX_BASE_URL ??
		environment.VITE_MLX_BASE_URL,
	model:
		runtimeConfiguration.MLX_MODEL ??
		environment.MLX_MODEL ??
		environment.VITE_MLX_MODEL,
	apiKey:
		runtimeConfiguration.MLX_API_KEY ??
		environment.MLX_API_KEY ??
		environment.VITE_MLX_API_KEY,
};

const externalCapabilities = __VOICE_WORKBENCH_WEB_SEARCH_AVAILABLE__
	? [createWebSearchCapability()]
	: [];
const domains = createDomainRegistry([
	createProductPricingDomainPack({
		priceCapability: createProductPriceCapability(),
	}),
]);
export const source = createVoiceWorkbenchSessionActor().start();
export const component = createVoiceWorkbenchComponent(source);

const runtime = createVoiceWorkbenchRuntime({
	actor: source,
	ports: {
		modelPreparation: async (request, { signal }) => {
			const fact = await probeMlxWorkbenchReadiness({
				...configuration,
				signal,
			});
			return fact.type === "MODEL_AVAILABLE"
				? { type: "available", sequence: request.sequence }
				: {
						type: "failed",
						sequence: request.sequence,
						failure: fact.failure,
					};
		},
		modelTurn: createWorkbenchModelTurnPort(
			configuration,
			externalCapabilities,
			domains,
			component,
		),
		voiceCapture: createBrowserVoiceCapturePort(),
		speechDelivery: createBrowserSpeechDeliveryPort(),
	},
});

component("voice-workbench", renderWorkbench);

const documentProjection = component(
	createProjectionDocumentTarget({
		commitDocument: (projectionDocument) => {
			source.send({
				type: "DOCUMENT_COMMITTED",
				document: {
					id: projectionDocument.id,
					title: projectionDocument.title,
					revision: projectionDocument.revision,
				},
			});
		},
	}),
);

let pageDisposed = false;
window.addEventListener("pagehide", (event) => {
	if (event.persisted || pageDisposed) return;
	pageDisposed = true;
	documentProjection.dispose();
	runtime.dispose();
	source.stop();
});
