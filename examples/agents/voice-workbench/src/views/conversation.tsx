/** @jsxImportSource ignite-element/jsx */

import type { WorkbenchProjection } from "../workbench-component";

export const renderConversationView = (context: WorkbenchProjection) => (
	<section
		class={`panel conversation${context.presentation.mobilePanel === "conversation" ? " is-mobile-active" : ""}`}
		data-panel="conversation"
		aria-label="Conversation"
	>
		<div class="panel-head">
			<div class="panel-title">
				<strong>Conversation</strong>
				<span>{context.sessionId}</span>
			</div>
			<span class="pill">continuing session</span>
		</div>
		<fieldset class="session-summary">
			<legend class="sr-only">Session summary</legend>
			<span class="session-stat">
				<strong>{context.turnLabel}</strong>
			</span>
			<span class="session-stat">
				<strong>{context.artifacts.length} artifacts</strong>
			</span>
			<span class="session-stat session-stat-speech">
				<strong>{context.speechStatus}</strong>
				<span>voice</span>
			</span>
		</fieldset>
		<div class="messages" aria-live="polite">
			{context.messages.length === 0 ? (
				<div class="empty-chat">
					<strong>Start with an outcome, not markup.</strong>
					<span>
						Ask the local model to create a plan, decision log, table, or
						another semantic artifact.
					</span>
				</div>
			) : null}
			{context.messages.map((message, index) => (
				<article
					key={`${message.role}-${index}`}
					class={`message ${message.role === "user" ? "message-user" : "message-agent"}`}
				>
					<div class="message-meta">
						<span>
							{message.role === "assistant"
								? "Ignite agent"
								: `${message.channel === "speech" ? "Speech" : "Text"} prompt`}
						</span>
					</div>
					<div class="message-bubble">{message.text}</div>
				</article>
			))}
			{context.status === "responding" ? (
				<article class="message message-agent">
					<div class="message-meta">Ignite agent · responding</div>
					<div class="message-bubble">
						<output class="typing" aria-label="Generating response">
							<i />
							<i />
							<i />
						</output>
					</div>
				</article>
			) : null}
		</div>
		<div class="composer-wrap">
			<output
				id="turn-result"
				class="sr-only"
				aria-live="assertive"
				data-replay={context.presentation.replaySequence}
			>
				{context.turnMessage}
			</output>
			<div class="permission-note" role="alert">
				<span aria-hidden="true">⚠</span>
				<div>
					<strong>
						{context.presentation.voice.type === "voice-permission-denied"
							? "Microphone access was denied"
							: "Speech input is unavailable"}
					</strong>
					<p>
						{context.voiceFailure?.message ?? "Speech input is unavailable."}{" "}
						Continue by typing; your current draft is preserved.
					</p>
				</div>
			</div>
			{context.modelPreparing || context.modelFailed ? (
				<section
					class={`model-notice ${context.modelFailed ? "model-notice-failed" : ""}`}
					role={context.modelFailed ? "alert" : "status"}
					aria-live="polite"
				>
					<span class="model-notice-icon" aria-hidden="true">
						{context.modelFailed ? "!" : "◌"}
					</span>
					<div>
						<strong>
							{context.modelFailed
								? "The local model is unavailable"
								: "Preparing the local MLX model"}
						</strong>
						<p>
							{context.modelFailed
								? (context.model.failure?.message ??
									"The local model could not be prepared.")
								: "The first launch may still be downloading and loading model weights. Prompt controls unlock after a real inference succeeds."}
						</p>
					</div>
					{context.modelFailed ? (
						<button
							class="button model-retry"
							type="button"
							onClick={() => context.beginModelPreparation()}
						>
							Retry model
						</button>
					) : null}
				</section>
			) : null}
			<form
				class="composer"
				onSubmit={(event: Event) => {
					event.preventDefault();
					const text = context.presentation.draft.trim();
					if (text) {
						context.submitPrompt({
							modality: "text",
							text,
						});
					}
				}}
			>
				<label class="sr-only" for="prompt">
					Prompt
				</label>
				<textarea
					id="prompt"
					name="prompt"
					placeholder={context.promptPlaceholder}
					value={context.presentation.draft}
					disabled={!context.canSubmitPrompt}
					onInput={(event: Event) =>
						context.changeDraft(
							(event.currentTarget as HTMLTextAreaElement).value,
						)
					}
				/>
				<div class="composer-actions">
					<span class="input-mode">Typed input</span>
					<button
						class="icon-button"
						id="mic-button"
						type="button"
						aria-label="Start speech input"
						title="Start speech input"
						disabled={context.microphoneUnavailable || !context.canSubmitPrompt}
						onClick={() => context.startVoiceCapture()}
					>
						<span aria-hidden="true">●</span>
					</button>
					<button
						class="send-button"
						type="submit"
						aria-label="Send"
						disabled={!context.canSubmitPrompt}
					>
						Send <span aria-hidden="true">→</span>
					</button>
				</div>
			</form>
			<div class="voice-capture" aria-live="polite">
				<div class="voice-top">
					<div class="voice-orb" aria-hidden="true">
						●
					</div>
					<div class="voice-copy">
						<strong id="voice-status">
							{context.transcriptReady ? "Transcript ready" : "Listening…"}
						</strong>
						<span id="live-transcript">
							{context.transcript ?? "Waiting for speech"}
						</span>
					</div>
					<div class="wave" aria-hidden="true">
						<i />
						<i />
						<i />
						<i />
						<i />
					</div>
				</div>
				<div class="voice-actions">
					<button
						class="button"
						id="cancel-voice"
						type="button"
						onClick={() => context.cancelVoiceCapture()}
					>
						Cancel
					</button>
					<button
						class="button button-primary"
						id="use-transcript"
						type="button"
						disabled={!context.transcriptReady}
						onClick={() => context.submitVoiceTranscript()}
					>
						Use transcript
					</button>
				</div>
			</div>
		</div>
	</section>
);
