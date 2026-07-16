/** @jsxImportSource ignite-element/jsx */
import {
	commitDocument,
	commitSpeech,
	component,
	recordTurn,
	recordTurnTerminal,
	recordVoiceCaptureLifecycle,
	reportModelAvailable,
	reportModelFailure,
	source,
} from "./session";
import { renderWorkbench } from "./workbench";

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

const recordParityVoice = (
	state: string,
	fact: Parameters<typeof recordVoiceCaptureLifecycle>[0]["fact"],
	attempted = false,
): void => {
	const sequence =
		(source.getSnapshot().context.childLifecycles.voiceCapture?.sequence ?? 0) +
		1;
	recordVoiceCaptureLifecycle({
		state,
		attemptId: attempted ? `parity-voice:${sequence}` : null,
		sequence,
		fact,
	});
};

const setIdleVoice = () => recordParityVoice("idle", { type: "voice-idle" });

const ensureResponding = async () => {
	if (component.getView().status === "responding") return;
	reportModelAvailable();
	await component.execute({
		command: "submitPrompt",
		input: {
			modality: "text",
			text: "Parity harness only — author a deterministic semantic artifact.",
		},
	});
};

const seedArtifact = async () => {
	await setIdleVoice();
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
	const turnId = source.getSnapshot().context.activeTurnId;
	const view = component.getView();
	const artifact = view.artifacts[0];
	if (artifact) {
		commitDocument({
			id: artifact.id,
			title: artifact.title,
			revision: artifact.revision,
		});
	}
	if (view.speech) {
		commitSpeech({
			id: view.speech.id,
			text: view.speech.text,
			status: "unavailable",
		});
		await component.execute({
			command: "acknowledgeSpeech",
			input: { id: view.speech.id },
		});
	}
	recordTurn({
		type: "accepted",
		trace: [
			{ command: "createArtifact", accepted: true },
			{ command: "completeResponse", accepted: true },
		],
	});
	if (turnId) recordTurnTerminal({ type: "TURN_COMPLETED", turnId });
	await component.execute({
		command: "changeMobilePanel",
		input: "artifact",
	});
};

export async function seedParityState(state: ParityState): Promise<void> {
	switch (state) {
		case "preparing":
			await component.execute({ command: "beginModelPreparation" });
			return;
		case "failed":
			reportModelFailure({
				kind: "provider",
				message: "Parity harness only — simulated model failure.",
			});
			return;
		case "ready":
			reportModelAvailable();
			return;
		case "listening":
			reportModelAvailable();
			recordParityVoice("listening", { type: "voice-listening" }, true);
			return;
		case "responding":
			await setIdleVoice();
			await ensureResponding();
			await component.execute({
				command: "changeMobilePanel",
				input: "artifact",
			});
			return;
		case "artifact":
			await seedArtifact();
			return;
		case "permission":
			reportModelAvailable();
			await component.execute({
				command: "changeDraft",
				input: "Parity harness draft stays available",
			});
			recordParityVoice(
				"permission-denied",
				{
					type: "voice-permission-denied",
					message: "Parity harness only — simulated microphone denial.",
				},
				true,
			);
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
window.addEventListener("pagehide", () => source.stop(), { once: true });
