/** @jsxImportSource ignite-element/jsx */

import type {
	WorkbenchArtifactView,
	WorkbenchPanel,
	WorkbenchTurnFact,
} from "./session";
import { component } from "./session";
import { workbenchStyles } from "./styles";

type WorkbenchRenderer = Extract<
	Parameters<typeof component>[1],
	(...args: never[]) => unknown
>;
type WorkbenchContext = Parameters<WorkbenchRenderer>[0];
type DocumentNode = WorkbenchContext["artifacts"][number]["nodes"][number];
export type WorkbenchPrompt = { channel: "text" | "speech"; text: string };
export type WorkbenchControls = {
	cancelVoice(): void;
	playSpeech(): void;
	replayTrace(): void;
	setArtifactView(view: WorkbenchArtifactView): void;
	setMobilePanel(panel: WorkbenchPanel): void;
	setSpeechPreference(enabled: boolean): void;
	startVoice(): void;
	submitPrompt(prompt: WorkbenchPrompt): void;
	updateDraft(draft: string): void;
	useVoiceTranscript(): void;
};

const commandNames = Object.keys(component.getSchema().commands);

const schemaDocument = (
	document: WorkbenchContext["artifacts"][number] | undefined,
) => {
	if (!document) return { artifacts: [] };
	return {
		id: document.id,
		title: document.title,
		revision: document.revision,
		nodes: document.nodes.map(({ action: _action, ...node }) => node),
	};
};

const describeFact = (fact: WorkbenchContext["lastFact"]): string => {
	if (!fact) return "no actor facts yet";
	switch (fact.type) {
		case "prompt-submitted":
			return `${fact.type} · ${fact.modality}`;
		case "artifact-created":
		case "artifact-revised":
			return `${fact.type} · revision ${fact.revision}`;
		case "artifact-rejected":
			return `${fact.type} · ${fact.reason}`;
		case "speech-acknowledged":
			return `${fact.type} · ${fact.id}`;
		case "response-completed":
			return fact.type;
	}
};

const voiceState = (
	fact: WorkbenchContext["presentation"]["voice"],
): "idle" | "listening" | "transcript" | "permission" | "unsupported" => {
	switch (fact.type) {
		case "voice-listening":
			return "listening";
		case "voice-transcript":
			return "transcript";
		case "voice-permission-denied":
		case "voice-error":
			return "permission";
		case "voice-unsupported":
			return "unsupported";
		case "voice-idle":
		case "voice-cancelled":
			return "idle";
	}
};

const describeTurn = (turn: WorkbenchTurnFact | null): string => {
	if (!turn) return "";
	switch (turn.type) {
		case "accepted":
			return "Actor accepted the model-authored turn.";
		case "model-failed":
			return turn.message;
		case "command-not-allowed":
			return `${turn.command} was not allowed by the model command policy.`;
		case "command-rejected":
			return `${turn.command} was rejected by the actor.`;
	}
};

const nodeHeading = (kind: DocumentNode["kind"], label: string) => (
	<h2>
		{label}
		<span class="node-kind">{kind}</span>
	</h2>
);

const renderNode = (node: DocumentNode, context: WorkbenchContext) => {
	switch (node.kind) {
		case "text":
			return (
				<section key={node.id} class="doc-card">
					{nodeHeading(node.kind, "Text")}
					<p>{node.text}</p>
				</section>
			);
		case "checklist":
			return (
				<section key={node.id} class="doc-card">
					{nodeHeading(node.kind, "Checklist")}
					<ul class="checklist" aria-label="Checklist">
						{node.items.map((item) => (
							<li key={item.id}>
								<input type="checkbox" checked={item.checked} disabled />
								<span>{item.label}</span>
							</li>
						))}
					</ul>
				</section>
			);
		case "action": {
			const action = node.action;
			return (
				<section key={node.id} class="doc-card">
					{nodeHeading(node.kind, "Authorized action")}
					{node.description ? <p>{node.description}</p> : null}
					<button
						class="node-action"
						type="button"
						disabled={!action?.enabled}
						onClick={() => {
							if (action?.enabled) context.completeResponse(action.input);
						}}
					>
						{node.label}
					</button>
				</section>
			);
		}
		case "form":
			return (
				<fieldset key={node.id} class="doc-card">
					<legend>{node.title ?? "Form"}</legend>
					<span class="node-kind">{node.kind}</span>
					{node.fields.map((field) => (
						<label key={field.id}>
							{field.label}
							<input
								name={field.id}
								value={
									typeof field.value === "string" ||
									typeof field.value === "number"
										? String(field.value)
										: ""
								}
								readOnly
							/>
							{field.description ? <small>{field.description}</small> : null}
						</label>
					))}
				</fieldset>
			);
		case "table":
			return (
				<section key={node.id} class="doc-card">
					{nodeHeading(node.kind, "Table")}
					<table>
						<thead>
							<tr>
								{node.columns.map((column) => (
									<th key={column.id} scope="col">
										{column.label}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{node.rows.map((row) => (
								<tr key={row.id}>
									{row.cells.map((cell, index) => (
										<td key={`${row.id}-${node.columns[index]?.id ?? index}`}>
											{String(cell ?? "")}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</section>
			);
		case "timeline":
			return (
				<section key={node.id} class="doc-card">
					{nodeHeading(node.kind, "Timeline")}
					<ol class="timeline" aria-label="Timeline">
						{node.events.map((timelineEvent) => (
							<li key={timelineEvent.id}>
								<time datetime={timelineEvent.timestamp}>
									{timelineEvent.timestamp}
								</time>{" "}
								<strong>{timelineEvent.label}</strong>
								{timelineEvent.detail ? <p>{timelineEvent.detail}</p> : null}
							</li>
						))}
					</ol>
				</section>
			);
		case "chart":
			return (
				<section key={node.id} class="doc-card">
					{nodeHeading(node.kind, `${node.chartType} chart`)}
					{node.series.map((series) => (
						<label key={series.id}>
							<span>
								{series.label}: {series.value}
							</span>
							<progress max="100" value={series.value} />
						</label>
					))}
				</section>
			);
		case "code-diff":
			return (
				<figure key={node.id} class="doc-card">
					<figcaption>
						{node.language ?? "Code"} diff
						<span class="node-kind">{node.kind}</span>
					</figcaption>
					<pre>
						<code>{`Before:\n${node.before ?? ""}\nAfter:\n${node.after ?? ""}`}</code>
					</pre>
				</figure>
			);
		case "decision-log":
			return (
				<section key={node.id} class="doc-card" aria-label="Decision log">
					{nodeHeading(node.kind, "Decision log")}
					{node.entries.map((entry) => (
						<article key={entry.id}>
							<h3>{entry.title}</h3>
							<p>{entry.decision}</p>
							{entry.rationale ? <p>{entry.rationale}</p> : null}
						</article>
					))}
				</section>
			);
	}
};

export const renderWorkbench = (
	context: WorkbenchContext,
	controls: WorkbenchControls,
) => {
	const activeArtifact =
		context.artifacts.find(
			(artifact) => artifact.id === context.activeArtifactId,
		) ?? context.artifacts[context.artifacts.length - 1];
	const turns = context.messages.filter(
		(message) => message.role === "user",
	).length;
	const turnLabel = `${turns} ${turns === 1 ? "turn" : "turns"}`;
	const speechStatus = context.speech?.status ?? "idle";
	const documentSchema = JSON.stringify(
		schemaDocument(activeArtifact),
		null,
		2,
	);
	const presentation = context.presentation;
	const voice = presentation.voice;
	const transcript = voice.type === "voice-transcript" ? voice.text : null;
	const transcriptReady = voice.type === "voice-transcript" && voice.final;
	const microphoneUnavailable = voice.type === "voice-unsupported";
	const voiceFailure =
		voice.type === "voice-permission-denied" || voice.type === "voice-error"
			? voice
			: null;
	const turnMessage = describeTurn(presentation.turn);

	return (
		<>
			<style>{workbenchStyles}</style>
			<div
				class="shell"
				data-actor-state={context.status}
				data-voice-state={voiceState(voice)}
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
						<output class="pill pill-success" aria-label="Conversation status">
							<i class="dot" /> {context.statusLabel}
						</output>
						<span class="pill">one component</span>
						<span class="pill">{commandNames.length} typed commands</span>
						<span class="pill">3 commit channels</span>
					</div>
					<div class="top-actions">
						<label class="switch">
							<span>Speak responses</span>
							<input
								id="speak-toggle"
								type="checkbox"
								checked={presentation.speakResponses}
								onChange={(event: Event) =>
									controls.setSpeechPreference(
										(event.currentTarget as HTMLInputElement).checked,
									)
								}
							/>
							<span class="switch-track" aria-hidden="true" />
						</label>
					</div>
				</header>

				<div class="workspace">
					<section
						class={`panel conversation${presentation.mobilePanel === "conversation" ? " is-mobile-active" : ""}`}
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
								<strong>{turnLabel}</strong>
							</span>
							<span class="session-stat">
								<strong>{context.artifacts.length} artifacts</strong>
							</span>
							<span class="session-stat session-stat-speech">
								<strong>{speechStatus}</strong>
								<span>voice</span>
							</span>
						</fieldset>
						<div class="messages" aria-live="polite">
							{context.messages.length === 0 ? (
								<div class="empty-chat">
									<strong>Start with an outcome, not markup.</strong>
									<span>
										Ask the local model to create a plan, decision log, table,
										or another semantic artifact.
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
								data-replay={presentation.replaySequence}
							>
								{turnMessage}
							</output>
							<div class="permission-note" role="alert">
								<span aria-hidden="true">⚠</span>
								<div>
									<strong>
										{voice.type === "voice-permission-denied"
											? "Microphone access was denied"
											: "Speech input is unavailable"}
									</strong>
									<p>
										{voiceFailure?.message ?? "Speech input is unavailable."}{" "}
										Continue by typing; your current draft is preserved.
									</p>
								</div>
							</div>
							<form
								class="composer"
								onSubmit={(event: Event) => {
									event.preventDefault();
									const text = presentation.draft.trim();
									if (text) {
										controls.submitPrompt({
											channel: "text",
											text,
										} satisfies WorkbenchPrompt);
									}
								}}
							>
								<label class="sr-only" for="prompt">
									Prompt
								</label>
								<textarea
									id="prompt"
									name="prompt"
									placeholder="Ask the agent to create or revise an artifact…"
									value={presentation.draft}
									disabled={!context.canSubmitPrompt}
									onInput={(event: Event) =>
										controls.updateDraft(
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
										disabled={microphoneUnavailable || !context.canSubmitPrompt}
										onClick={controls.startVoice}
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
											{transcriptReady ? "Transcript ready" : "Listening…"}
										</strong>
										<span id="live-transcript">
											{transcript ?? "Waiting for speech"}
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
										onClick={controls.cancelVoice}
									>
										Cancel
									</button>
									<button
										class="button button-primary"
										id="use-transcript"
										type="button"
										disabled={!transcriptReady}
										onClick={controls.useVoiceTranscript}
									>
										Use transcript
									</button>
								</div>
							</div>
						</div>
					</section>

					<main
						class={`panel artifact${presentation.mobilePanel === "artifact" ? " is-mobile-active" : ""}`}
						data-panel="artifact"
						data-view={presentation.artifactView}
					>
						<div class="artifact-toolbar">
							<div class="artifact-identity">
								<strong>{activeArtifact?.title ?? "Artifact workspace"}</strong>
								<span>
									{activeArtifact
										? `${activeArtifact.id} · revision ${activeArtifact.revision}`
										: "empty session · revision 0"}
								</span>
							</div>
							{activeArtifact ? (
								<span class="pill pill-success">committed</span>
							) : null}
							<div class="segmented" role="tablist" aria-label="Artifact view">
								<button
									id="document-tab"
									role="tab"
									type="button"
									data-view="document"
									aria-selected={presentation.artifactView === "document"}
									onClick={() => controls.setArtifactView("document")}
								>
									Document
								</button>
								<button
									id="schema-tab"
									role="tab"
									type="button"
									data-view="schema"
									aria-selected={presentation.artifactView === "schema"}
									onClick={() => controls.setArtifactView("schema")}
								>
									Schema
								</button>
							</div>
							<button
								class="icon-button"
								id="play-summary"
								type="button"
								aria-label="Play spoken summary"
								title="Play spoken summary"
								disabled={!context.response?.speech}
								onClick={controls.playSpeech}
							>
								<span aria-hidden="true">◖</span>
							</button>
						</div>
						<div class="artifact-scroll">
							<div class="proof-banner">
								<span aria-hidden="true">✓</span>
								<div>
									<strong>This document is the live proof.</strong>
									<span>
										Accepted text or speech commands update this center
										artifact, its schema, and every commit receipt.
									</span>
								</div>
							</div>
							{activeArtifact ? (
								<article class="document" data-artifact-document="">
									<div class="doc-kicker">
										Actor-owned artifact · revision {activeArtifact.revision}
									</div>
									<h1>{activeArtifact.title ?? activeArtifact.id}</h1>
									<div class="doc-grid">
										{activeArtifact.nodes.map((node) =>
											renderNode(node, context),
										)}
									</div>
								</article>
							) : (
								<section class="empty-artifact">
									<div>
										<strong>
											Your first accepted artifact will appear here
										</strong>
										<p>
											The model proposes semantic nodes. The actor validates and
											stores them before Ignite renders anything.
										</p>
									</div>
								</section>
							)}
							<section class="schema-view" aria-label="Artifact schema">
								<pre>{documentSchema}</pre>
							</section>
							<div class="responding-overlay" aria-live="polite">
								<div class="progress-card">
									<strong>Authoring the semantic artifact</strong>
									<span>Actor state: responding</span>
									<div class="progress-steps">
										<div class="progress-step done">Prompt admitted</div>
										<div class="progress-step done">Current tools derived</div>
										<div class="progress-step active">
											Model proposing commands
										</div>
										<div class="progress-step">
											Actor validating semantic nodes
										</div>
									</div>
								</div>
							</div>
						</div>
					</main>

					<aside
						class={`panel runtime${presentation.mobilePanel === "runtime" ? " is-mobile-active" : ""}`}
						data-panel="runtime"
						aria-label="Ignite runtime"
					>
						<div class="panel-head">
							<div class="panel-title">
								<strong>Proof of the current session</strong>
								<span>prompt → actor → commits</span>
							</div>
							<button
								class="text-button"
								type="button"
								onClick={controls.replayTrace}
							>
								Replay
							</button>
						</div>
						<div class="runtime-scroll">
							<section class="runtime-card">
								<div class="runtime-card-head">
									<strong>One component, four consumers</strong>
									<span>{commandNames.length} commands</span>
								</div>
								<div class="component-contract">
									<div class="component-line">
										const component = <strong>igniteCore({`{...}`})</strong>
									</div>
									<div class="component-uses">
										<span class="component-use">headless test</span>
										<span class="component-use">browser JSX</span>
										<span class="component-use">terminal + speech</span>
									</div>
									<div class="actor-state">
										<div class="state-node" aria-hidden="true">
											◆
										</div>
										<div class="actor-copy">
											<strong>{context.sessionId}</strong>
											<span>
												matches(<code>"{context.status}"</code>)
											</span>
											<output class="latest-fact">
												{describeFact(context.lastFact)}
											</output>
										</div>
									</div>
								</div>
							</section>
							<section class="runtime-card">
								<div class="runtime-card-head">
									<strong>Authorized turn trace</strong>
									<span>model proposes · actor decides</span>
								</div>
								<ol class="turn-trace">
									<li class="trace-step">
										<i class="trace-marker" />
										<span class="trace-copy">
											<strong>Text or speech transcript</strong>
											<span>outer adapter → text + modality</span>
										</span>
									</li>
									<li class="trace-step">
										<i class="trace-marker" />
										<span class="trace-copy">
											<strong>{describeFact(context.lastFact)}</strong>
											<span>current public actor fact</span>
										</span>
									</li>
									<li class="trace-step">
										<i class="trace-marker" />
										<span class="trace-copy">
											<strong>
												{activeArtifact
													? `Artifact revision ${activeArtifact.revision} stored`
													: "Awaiting accepted artifact"}
											</strong>
											<span>semantic nodes, never generated DOM</span>
										</span>
									</li>
								</ol>
							</section>
							<section class="runtime-card">
								<div class="runtime-card-head">
									<strong>Channel commits</strong>
									<span>same accepted actor state</span>
								</div>
								<div class="commit-list">
									<div class="commit">
										<span class="commit-icon">▤</span>
										<span class="commit-copy">
											<strong>Browser · native JSX</strong>
											<span>
												{presentation.documentCommit
													? `${presentation.documentCommit.id} · revision ${presentation.documentCommit.revision}`
													: "awaiting artifact"}
											</span>
										</span>
										<span class="commit-status">
											{presentation.documentCommit ? "current" : "idle"}
										</span>
									</div>
									<div class="commit commit-terminal">
										<span class="commit-icon">›_</span>
										<span class="commit-copy">
											<strong>Terminal · text</strong>
											<span>
												{presentation.terminalCommit?.text ?? "no DOM required"}
											</span>
										</span>
										<span class="commit-status">
											{presentation.terminalCommit ? "written" : "idle"}
										</span>
									</div>
									<div class="commit commit-speech">
										<span class="commit-icon">◖</span>
										<span class="commit-copy">
											<strong>Speech · audio</strong>
											<span>
												{presentation.speechCommit?.text ??
													"browser adapter · actor acknowledged"}
											</span>
										</span>
										<span class="commit-status">
											{presentation.speechCommit?.status ?? "idle"}
										</span>
									</div>
								</div>
							</section>
							<section class="runtime-card">
								<div class="runtime-card-head">
									<strong>Authorized schema</strong>
									<span>getSchema() → igniteTools</span>
								</div>
								<div class="runtime-body">
									<div class="command-list">
										{commandNames.map((name) => (
											<span key={name} class="command">
												{name}
											</span>
										))}
									</div>
									<div class="policy-proof">
										<span aria-hidden="true">◇</span>
										<div>
											<strong>renderJavascript rejected</strong>
											<span>
												{commandNames.includes("renderJavascript")
													? "unexpectedly admitted"
													: "command-not-allowed · absent from schema"}
											</span>
										</div>
									</div>
								</div>
							</section>
						</div>
					</aside>
				</div>

				<nav class="mobile-tabs" aria-label="Workbench views">
					<button
						type="button"
						data-target="conversation"
						aria-pressed={presentation.mobilePanel === "conversation"}
						onClick={() => controls.setMobilePanel("conversation")}
					>
						Chat
					</button>
					<button
						type="button"
						data-target="artifact"
						aria-pressed={presentation.mobilePanel === "artifact"}
						onClick={() => controls.setMobilePanel("artifact")}
					>
						Artifact
					</button>
					<button
						type="button"
						data-target="runtime"
						aria-pressed={presentation.mobilePanel === "runtime"}
						onClick={() => controls.setMobilePanel("runtime")}
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
