/** @jsxImportSource ignite-element/jsx */

import type { WorkbenchProjection } from "./workbench-component";
import { workbenchStyles } from "./styles";
import { renderArtifactView } from "./views/artifact";
import { renderConversationView } from "./views/conversation";
import { renderRuntimeView } from "./views/runtime";

type WorkbenchContext = WorkbenchProjection;

export const renderWorkbench = (context: WorkbenchContext) => {
	return (
		<>
			<style>{workbenchStyles}</style>
			<div
				class="shell"
				data-actor-state={context.status}
				data-voice-state={context.voiceState}
			>
				<header class="topbar">
					<div class="brand">
						<div class="brand-mark" aria-hidden="true">
							◆
						</div>
						<div class="brand-copy">
							<strong>Ignite Element</strong>
							<span>Voice + text workbench</span>
						</div>
					</div>
					<div class="topbar-center">
						<output
							class={`pill ${context.modelPreparing ? "pill-preparing" : context.modelFailed ? "pill-failed" : "pill-success"}`}
							aria-label="Conversation status"
						>
							<i class="dot" /> {context.statusLabel}
						</output>
						<span class="pill">one component</span>
						<span class="pill">{context.commandCount} typed commands</span>
						<span class="pill">3 projection channels</span>
					</div>
					<div class="top-actions">
						<label class="switch">
							<span>Speak responses</span>
							<input
								id="speak-toggle"
								type="checkbox"
								checked={context.presentation.speakResponses}
								onChange={(event: Event) =>
									context.changeSpeechPreference(
										(event.currentTarget as HTMLInputElement).checked,
									)
								}
							/>
							<span class="switch-track" aria-hidden="true" />
						</label>
					</div>
				</header>

				<div class="workspace">
					{renderConversationView(context)}
					{renderArtifactView(context)}
					{renderRuntimeView(context)}
				</div>

				<nav class="mobile-tabs" aria-label="Workbench views">
					<button
						type="button"
						data-target="conversation"
						aria-pressed={context.presentation.mobilePanel === "conversation"}
						onClick={() => context.changeMobilePanel("conversation")}
					>
						Chat
					</button>
					<button
						type="button"
						data-target="artifact"
						aria-pressed={context.presentation.mobilePanel === "artifact"}
						onClick={() => context.changeMobilePanel("artifact")}
					>
						Artifact
					</button>
					<button
						type="button"
						data-target="runtime"
						aria-pressed={context.presentation.mobilePanel === "runtime"}
						onClick={() => context.changeMobilePanel("runtime")}
					>
						Runtime
					</button>
				</nav>
				<footer class="statusbar">
					<strong>same component</strong>
					<span>
						→ getSchema() → authorized command → actor revision → JSX + terminal
						+ speech
					</span>
				</footer>
			</div>
		</>
	);
};
