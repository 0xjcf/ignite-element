/** @jsxImportSource ignite-element/jsx */
import { component, source } from "./session";
import { renderWorkbench, type WorkbenchEnvironment } from "./workbench";

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

export const parityEnvironment = {
	cancelVoice: () =>
		source.send({
			type: "PRESENTATION_VOICE_CHANGED",
			fact: { type: "voice-cancelled" },
		}),
	playSpeech: () => {
		const speech = component.getView().speech;
		if (!speech) return;
		source.send({
			type: "PRESENTATION_SPEECH_COMMITTED",
			speech: { id: speech.id, text: speech.text, status: "unavailable" },
		});
	},
	retryModel: () => source.send({ type: "MODEL_PREPARATION_STARTED" }),
	startVoice: () =>
		source.send({
			type: "PRESENTATION_VOICE_CHANGED",
			fact: { type: "voice-listening" },
		}),
	submitPrompt: (prompt) => {
		void component.execute({
			command: "submitPrompt",
			input: { modality: prompt.channel, text: prompt.text },
		});
	},
	useVoiceTranscript: () => {},
} satisfies WorkbenchEnvironment;

const setIdleVoice = () =>
	source.send({
		type: "PRESENTATION_VOICE_CHANGED",
		fact: { type: "voice-idle" },
	});

const ensureResponding = async () => {
	if (component.getView().status === "responding") return;
	source.send({ type: "MODEL_AVAILABLE" });
	await component.execute({
		command: "submitPrompt",
		input: {
			modality: "text",
			text: "Parity harness only — author a deterministic semantic artifact.",
		},
	});
};

const seedArtifact = async () => {
	setIdleVoice();
	await ensureResponding();
	if (component.getView().artifacts.length === 0) {
		await component.execute({
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
	await component.execute({
		command: "completeResponse",
		input: {
			text: "Parity harness only — deterministic response committed.",
			speech: "Parity harness only — deterministic spoken summary.",
		},
	});
	const view = component.getView();
	const artifact = view.artifacts[0];
	if (artifact) {
		source.send({
			type: "PRESENTATION_DOCUMENT_COMMITTED",
			document: {
				id: artifact.id,
				title: artifact.title,
				revision: artifact.revision,
			},
		});
	}
	source.send({
		type: "PRESENTATION_TERMINAL_COMMITTED",
		terminal: { text: "Parity harness only — terminal receipt." },
	});
	if (view.speech) {
		source.send({
			type: "PRESENTATION_SPEECH_COMMITTED",
			speech: {
				id: view.speech.id,
				text: view.speech.text,
				status: "unavailable",
			},
		});
		await component.execute({
			command: "acknowledgeSpeech",
			input: { id: view.speech.id },
		});
	}
	source.send({
		type: "PRESENTATION_TURN_RECORDED",
		fact: {
			type: "accepted",
			trace: [
				{ command: "createArtifact", accepted: true },
				{ command: "completeResponse", accepted: true },
			],
		},
	});
	source.send({
		type: "PRESENTATION_MOBILE_PANEL_CHANGED",
		panel: "artifact",
	});
};

export async function seedParityState(state: ParityState): Promise<void> {
	switch (state) {
		case "preparing":
			source.send({ type: "MODEL_PREPARATION_STARTED" });
			return;
		case "failed":
			source.send({
				type: "MODEL_FAILED",
				failure: {
					kind: "provider",
					message: "Parity harness only — simulated model failure.",
				},
			});
			return;
		case "ready":
			source.send({ type: "MODEL_AVAILABLE" });
			return;
		case "listening":
			source.send({ type: "MODEL_AVAILABLE" });
			source.send({
				type: "PRESENTATION_VOICE_CHANGED",
				fact: { type: "voice-listening" },
			});
			return;
		case "responding":
			setIdleVoice();
			await ensureResponding();
			source.send({
				type: "PRESENTATION_MOBILE_PANEL_CHANGED",
				panel: "artifact",
			});
			return;
		case "artifact":
			await seedArtifact();
			return;
		case "permission":
			source.send({ type: "MODEL_AVAILABLE" });
			source.send({
				type: "PRESENTATION_DRAFT_CHANGED",
				draft: "Parity harness draft stays available",
			});
			source.send({
				type: "PRESENTATION_VOICE_CHANGED",
				fact: {
					type: "voice-permission-denied",
					message: "Parity harness only — simulated microphone denial.",
				},
			});
			return;
	}
}

export async function mountParityHarness(state: ParityState) {
	await seedParityState(state);
	return component("voice-workbench-parity", (projection) => (
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
			{renderWorkbench(projection, parityEnvironment)}
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
window.addEventListener("pagehide", () => source.stop(), { once: true });
