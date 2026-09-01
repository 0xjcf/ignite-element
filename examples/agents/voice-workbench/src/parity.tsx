/** @jsxImportSource ignite-element/jsx */
import { createVoiceWorkbenchSessionActor } from "./session";
import type { ModelTurnPortRequest } from "./model-turn";
import { createVoiceWorkbenchComponent } from "./workbench-component";
import { renderWorkbench } from "./workbench";

export const paritySource = createVoiceWorkbenchSessionActor().start();
export const parityComponent = createVoiceWorkbenchComponent(paritySource);

const settleModelPreparation = (available: boolean) => {
	if (paritySource.getSnapshot().matches("unavailable")) {
		paritySource.send({ type: "MODEL_PREPARATION_STARTED" });
	}
	const request =
		paritySource.getSnapshot().context.portRequests.modelPreparation;
	if (!request) return;
	paritySource.send({
		type: "MODEL_PREPARATION_PORT_RECEIVED",
		request,
		receipt: available
			? { type: "available", sequence: request.sequence }
			: {
					type: "failed",
					sequence: request.sequence,
					failure: {
						kind: "provider",
						message: "Parity harness only — simulated model failure.",
					},
				},
	});
};

const currentModelTurnRequest = (): ModelTurnPortRequest => {
	const request = paritySource.getSnapshot().context.portRequests.modelTurn;
	if (!request)
		throw new Error("Parity harness expected a model-turn request.");
	return request;
};

const completeSeededModelTurn = () => {
	let request = currentModelTurnRequest();
	paritySource.send({
		type: "MODEL_TURN_PORT_RECEIVED",
		request,
		receipt: {
			type: "MODEL_RESOLVED",
			turnId: request.turnId,
			attemptId: request.attemptId,
			result: {
				ok: true,
				calls: [
					{
						id: "parity-complete",
						command: "completeResponse",
						input: {
							text: "Parity harness only — deterministic response committed.",
							speech: "Parity harness only — deterministic spoken summary.",
						},
					},
				],
			},
		},
	});
	request = currentModelTurnRequest();
	paritySource.send({
		type: "MODEL_TURN_PORT_RECEIVED",
		request,
		receipt: {
			type: "AUTHORIZATION_RESOLVED",
			turnId: request.turnId,
			attemptId: request.attemptId,
			allowed: true,
		},
	});
	request = currentModelTurnRequest();
	if (request.type !== "execute-call") {
		throw new Error("Parity harness expected an executable model proposal.");
	}
	paritySource.send({
		type: "MODEL_TURN_PORT_RECEIVED",
		request,
		receipt: {
			type: "CAPABILITY_RESOLVED",
			turnId: request.turnId,
			attemptId: request.attemptId,
			feedback: {
				id: request.call.id ?? "parity-complete",
				command: request.call.command,
				status: "accepted",
				ownerId: "voice-workbench-parity",
				view: parityComponent.getStates().modelContext,
				events: [],
			},
		},
	});
};

export const PARITY_STATES = [
	"preparing",
	"failed",
	"ready",
	"listening",
	"responding",
	"artifact",
	"permission",
] as const;

export type ParityState = (typeof PARITY_STATES)[number];

const isParityState = (value: string): value is ParityState =>
	PARITY_STATES.includes(value as ParityState);

export function resolveParityState(search: string): ParityState | null {
	const requested = new URLSearchParams(search).get("state") ?? "ready";
	return isParityState(requested) ? requested : null;
}

const ensureResponding = async () => {
	if (parityComponent.getStates().status === "responding") return;
	settleModelPreparation(true);
	await parityComponent.execute({
		command: "submitPrompt",
		input: {
			modality: "text",
			text: "Parity harness only — author a deterministic semantic artifact.",
		},
	});
};

const seedArtifact = async () => {
	await ensureResponding();
	if (parityComponent.getStates().artifacts.length === 0) {
		await parityComponent.execute({
			command: "createArtifact",
			input: {
				id: "parity-artifact",
				title: "Parity harness only — semantic artifact",
				nodes: [
					{
						kind: "text",
						id: "parity-summary",
						text: "Deterministic parity content; never production seed data.",
					},
					{
						kind: "decision-log",
						id: "parity-decisions",
						entries: [
							{
								id: "parity-decision",
								title: "Test-only state",
								decision: "Use real commands to seed the parity harness.",
								rationale:
									"Keep deterministic fixtures outside the live entrypoint.",
							},
						],
					},
				],
			},
		});
	}
	await parityComponent.execute({
		command: "completeResponse",
		input: {
			text: "Parity harness only — deterministic response committed.",
			speech: "Parity harness only — deterministic spoken summary.",
		},
	});
	const view = parityComponent.getStates();
	const artifact = view.artifacts[0];
	if (artifact) {
		paritySource.send({
			type: "DOCUMENT_COMMITTED",
			document: {
				id: artifact.id,
				title: artifact.title,
				revision: artifact.revision,
			},
		});
	}
	completeSeededModelTurn();
	const speechRequest = parityComponent.getStates().portRequests.speechDelivery;
	if (speechRequest) {
		paritySource.send({
			type: "SPEECH_DELIVERY_PORT_RECEIVED",
			request: speechRequest,
			receipt: {
				type: "UNAVAILABLE",
				attemptId: speechRequest.attemptId,
			},
		});
		const speech = parityComponent.getStates().speech;
		if (speech?.id === speechRequest.id && speech.status === "pending") {
			await parityComponent.execute({
				command: "acknowledgeSpeech",
				input: { id: speech.id },
			});
		}
	}
	await parityComponent.execute({
		command: "changeMobilePanel",
		input: "artifact",
	});
};

export async function seedParityState(state: ParityState): Promise<void> {
	switch (state) {
		case "preparing":
			await parityComponent.execute({ command: "beginModelPreparation" });
			return;
		case "failed":
			settleModelPreparation(false);
			return;
		case "ready":
			settleModelPreparation(true);
			return;
		case "listening":
			settleModelPreparation(true);
			await parityComponent.execute({ command: "startVoiceCapture" });
			return;
		case "responding":
			await ensureResponding();
			await parityComponent.execute({
				command: "changeMobilePanel",
				input: "artifact",
			});
			return;
		case "artifact":
			await seedArtifact();
			return;
		case "permission":
			settleModelPreparation(true);
			await parityComponent.execute({
				command: "changeDraft",
				input: "Parity harness draft stays available",
			});
			await parityComponent.execute({ command: "startVoiceCapture" });
			{
				const request = parityComponent.getStates().portRequests.voiceCapture;
				if (request?.type === "start" && request.attemptId) {
					paritySource.send({
						type: "VOICE_CAPTURE_PORT_RECEIVED",
						request,
						receipt: {
							type: "PERMISSION_DENIED",
							attemptId: request.attemptId,
							message: "Parity harness only — simulated microphone denial.",
						},
					});
				}
			}
			return;
	}
}

export async function mountParityHarness(state: ParityState) {
	await seedParityState(state);
	return parityComponent("voice-workbench-parity", (projection) => (
		<>
			<style>{`
				.parity-badge {
					position: fixed;
					right: 0.6rem;
					bottom: 0.45rem;
					z-index: 100;
					padding: 0.22rem 0.5rem;
					border: 1px solid var(--warning);
					border-radius: var(--radius-sm);
					background: var(--background-elevated);
					color: var(--warning);
					font: 600 0.62rem/1.4 var(--font-mono);
					pointer-events: none;
				}
				@media (max-width: 50rem) {
					.parity-badge {
						top: 0.35rem;
						right: 0.45rem;
						bottom: auto;
						max-width: 7.5rem;
						font-size: 0.52rem;
						text-align: right;
					}
				}
			`}</style>
			<output class="parity-badge">Test-only parity harness · {state}</output>
			{renderWorkbench(projection)}
		</>
	));
}

const state = resolveParityState(window.location.search);
if (!state) {
	throw new Error(
		`Unknown parity state. Expected one of: ${PARITY_STATES.join(", ")}.`,
	);
}
void mountParityHarness(state);
window.addEventListener("pagehide", () => paritySource.stop(), { once: true });
