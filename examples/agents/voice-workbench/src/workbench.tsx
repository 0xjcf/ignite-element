/** @jsxImportSource ignite-element/jsx */

import {
	type WorkbenchCapabilityProof,
	type WorkbenchProjection,
	workbenchCommandNames,
} from "./session";
import { workbenchStyles } from "./styles";

type WorkbenchContext = WorkbenchProjection;
type DocumentNode = WorkbenchContext["artifacts"][number]["nodes"][number];

const nodeHeading = (kind: DocumentNode["kind"], label: string) => (
	<h2>
		{label}
		<span class="node-kind">{kind}</span>
	</h2>
);

const sourceLink = (value: unknown) => {
	if (typeof value !== "string") return null;
	try {
		const url = new URL(value);
		if (url.protocol !== "https:" && url.protocol !== "http:") return null;
		return (
			<a
				class="source-link"
				href={url.href}
				target="_blank"
				rel="noopener noreferrer"
				aria-label={`Source: ${url.hostname}`}
			>
				<span>{url.hostname}</span>
				<span aria-hidden="true">↗</span>
			</a>
		);
	} catch {
		return null;
	}
};

const renderCell = (value: unknown) => sourceLink(value) ?? String(value ?? "");

const capabilityProofSummary = (proof: WorkbenchCapabilityProof): string =>
	[
		proof.outcome,
		proof.status === undefined ? null : `HTTP ${proof.status}`,
		proof.queryCount === undefined
			? null
			: `${proof.queryCount} ${proof.queryCount === 1 ? "query" : "queries"}`,
		proof.sourceCount === undefined
			? null
			: `${proof.sourceCount} ${proof.sourceCount === 1 ? "source" : "sources"}`,
	]
		.filter((value): value is string => value !== null)
		.join(" · ");

const renderNode = (node: DocumentNode, context: WorkbenchContext) => {
	switch (node.kind) {
		case "text":
			return (
				<section key={node.id} class="doc-card" data-node-kind={node.kind}>
					{nodeHeading(node.kind, "Text")}
					<p>{node.text}</p>
				</section>
			);
		case "checklist":
			return (
				<section key={node.id} class="doc-card" data-node-kind={node.kind}>
					{nodeHeading(node.kind, "Checklist")}
					<ul class="checklist" aria-label="Checklist">
						{node.items.map((item) => (
							<li key={item.id}>
								<label>
									<input
										type="checkbox"
										checked={item.checked}
										disabled={
											!context.canSetChecklistItem || !context.activeArtifact
										}
										onChange={(event: Event) => {
											const artifact = context.activeArtifact;
											if (!artifact) return;
											context.setChecklistItem({
												artifactId: artifact.id,
												expectedRevision: artifact.revision,
												nodeId: node.id,
												itemId: item.id,
												checked: (event.currentTarget as HTMLInputElement)
													.checked,
											});
										}}
									/>
									<span>{item.label}</span>
								</label>
							</li>
						))}
					</ul>
				</section>
			);
		case "action": {
			const action = node.action;
			return (
				<section key={node.id} class="doc-card" data-node-kind={node.kind}>
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
				<fieldset key={node.id} class="doc-card" data-node-kind={node.kind}>
					<legend>{node.title ?? "Form"}</legend>
					<span class="node-kind">{node.kind}</span>
					{node.fields.map((field) => (
						<label key={field.id} for={`${node.id}-${field.id}`}>
							{field.label}
							<input
								id={`${node.id}-${field.id}`}
								name={field.id}
								aria-label={field.label}
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
				<section key={node.id} class="doc-card" data-node-kind={node.kind}>
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
											{renderCell(cell)}
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
				<section key={node.id} class="doc-card" data-node-kind={node.kind}>
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
		case "chart": {
			const maximum = Math.max(
				1,
				...node.series.map((series) => Math.abs(series.value)),
			);
			const accessibleSummary = node.series
				.map((series) => `${series.label} ${series.value}`)
				.join(", ");
			return (
				<figure
					key={node.id}
					class="doc-card"
					data-node-kind={node.kind}
					aria-label={`${node.chartType} chart: ${accessibleSummary}`}
				>
					{nodeHeading(node.kind, `${node.chartType} chart`)}
					{node.series.map((series) => (
						<label key={series.id}>
							<span>
								{series.label}: {series.value}
							</span>
							<progress
								max={maximum}
								value={Math.max(0, series.value)}
								aria-label={`${series.label}: ${series.value}`}
							/>
						</label>
					))}
				</figure>
			);
		}
		case "code-diff":
			return (
				<figure key={node.id} class="doc-card" data-node-kind={node.kind}>
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
				<section
					key={node.id}
					class="doc-card"
					data-node-kind={node.kind}
					aria-label="Decision log"
				>
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
						<span class="pill">
							{workbenchCommandNames.length} typed commands
						</span>
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
								data-replay={context.presentation.replaySequence}
							>
								{context.turnMessage}
							</output>
							<div class="permission-note" role="alert">
								<span aria-hidden="true">⚠</span>
								<div>
									<strong>
										{context.presentation.voice.type ===
										"voice-permission-denied"
											? "Microphone access was denied"
											: "Speech input is unavailable"}
									</strong>
									<p>
										{context.voiceFailure?.message ??
											"Speech input is unavailable."}{" "}
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
										disabled={
											context.microphoneUnavailable || !context.canSubmitPrompt
										}
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
											{context.transcriptReady
												? "Transcript ready"
												: "Listening…"}
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

					<main
						class={`panel artifact${context.presentation.mobilePanel === "artifact" ? " is-mobile-active" : ""}`}
						data-panel="artifact"
						data-view={context.presentation.artifactView}
					>
						<div class="artifact-toolbar">
							<div class="artifact-identity">
								<strong>
									{context.activeArtifact?.title ?? "Artifact workspace"}
								</strong>
								<span>
									{context.activeArtifact
										? `${context.activeArtifact.id} · revision ${context.activeArtifact.revision}`
										: "empty session · revision 0"}
								</span>
							</div>
							{context.activeArtifact ? (
								<span class="pill pill-success">committed</span>
							) : null}
							<div class="segmented" role="tablist" aria-label="Artifact view">
								<button
									id="document-tab"
									role="tab"
									type="button"
									data-view="document"
									aria-selected={
										context.presentation.artifactView === "document"
									}
									onClick={() => context.changeArtifactView("document")}
								>
									Document
								</button>
								<button
									id="schema-tab"
									role="tab"
									type="button"
									data-view="schema"
									aria-selected={context.presentation.artifactView === "schema"}
									onClick={() => context.changeArtifactView("schema")}
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
								onClick={() => context.playSpeech()}
							>
								<span aria-hidden="true">◖</span>
							</button>
						</div>
						<div class="artifact-scroll">
							{context.artifactSummaries.length > 0 ? (
								<nav class="artifact-switcher" aria-label="Artifacts">
									<div class="artifact-switcher-label">
										<strong>Workspace</strong>
										<span>
											{context.artifactSummaries.length} accepted{" "}
											{context.artifactSummaries.length === 1
												? "artifact"
												: "artifacts"}
										</span>
									</div>
									<div class="artifact-switcher-list">
										{context.artifactSummaries.map((artifact) => (
											<button
												key={artifact.id}
												class={`artifact-switcher-item${artifact.active ? " is-active" : ""}`}
												type="button"
												aria-label={`${artifact.title}, revision ${artifact.revision}`}
												aria-current={artifact.active ? "page" : undefined}
												onClick={() =>
													context.selectArtifact({ artifactId: artifact.id })
												}
											>
												<strong>{artifact.title}</strong>
												<span>
													r{artifact.revision} · {artifact.nodeCount}{" "}
													{artifact.nodeCount === 1 ? "node" : "nodes"}
												</span>
											</button>
										))}
									</div>
								</nav>
							) : null}
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
							{!context.activeArtifact &&
							(context.modelPreparing || context.modelFailed) ? (
								<section
									class={`model-state ${context.modelFailed ? "model-state-failed" : ""}`}
									aria-live="polite"
								>
									<div class="model-state-mark" aria-hidden="true">
										{context.modelFailed ? "!" : "◆"}
									</div>
									<strong>
										{context.modelFailed
											? "Local inference is not available yet"
											: "Preparing the local MLX model"}
									</strong>
									<p>
										{context.modelFailed
											? "Retry from the conversation panel. The actor will keep prompts closed until inference succeeds."
											: "The workbench is already mounted. Ignite will project Ready only after the model completes a real warm-up inference."}
									</p>
									{context.modelPreparing ? (
										<div class="model-progress" aria-hidden="true">
											<i />
										</div>
									) : null}
									<span class="model-state-detail">
										{context.modelFailed
											? (context.model.failure?.message ??
												"The local model could not be prepared.")
											: "Endpoint connected · inference warm-up in progress"}
									</span>
								</section>
							) : context.activeArtifact ? (
								<article class="document" data-artifact-document="">
									<div class="doc-kicker">
										Actor-owned artifact · revision{" "}
										{context.activeArtifact.revision}
									</div>
									<h1>
										{context.activeArtifact.title ?? context.activeArtifact.id}
									</h1>
									{context.activeArtifactRevisions.length > 1 ? (
										<section
											class="revision-history"
											aria-label="Revision history"
										>
											<div class="revision-history-label">
												<strong>Revision history</strong>
												<span>Restore appends a new revision</span>
											</div>
											<div class="revision-history-list">
												{context.activeArtifactRevisions.map((revision) => (
													<button
														key={revision.revision}
														class={revision.current ? "is-current" : ""}
														type="button"
														disabled={
															revision.current ||
															!context.canRestoreArtifactRevision
														}
														aria-label={
															revision.current
																? `Current revision ${revision.revision}`
																: `Restore revision ${revision.revision}`
														}
														onClick={() =>
															context.restoreArtifactRevision({
																artifactId: context.activeArtifact.id,
																expectedRevision:
																	context.activeArtifact.revision,
																revision: revision.revision,
															})
														}
													>
														<strong>Revision {revision.revision}</strong>
														<span>
															{revision.nodeCount}{" "}
															{revision.nodeCount === 1 ? "node" : "nodes"}
														</span>
													</button>
												))}
											</div>
										</section>
									) : null}
									<div class="doc-grid">
										{context.activeArtifact.nodes.map((node) =>
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
								<pre>{context.documentSchema}</pre>
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
						class={`panel runtime${context.presentation.mobilePanel === "runtime" ? " is-mobile-active" : ""}`}
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
								onClick={() => context.replay()}
							>
								Replay
							</button>
						</div>
						<div class="runtime-scroll">
							<section class="runtime-card">
								<div class="runtime-card-head">
									<strong>One component, four consumers</strong>
									<span>{workbenchCommandNames.length} commands</span>
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
											<pre class="actor-match">
												<span>{"matches("}</span>
												<code>{`{
  provider: "${context.model.status}",
  turn: "${context.turnState}",
}`}</code>
												<span>{")"}</span>
											</pre>
											<output class="latest-fact">
												{context.lastFactLabel}
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
											<strong>{context.lastFactLabel}</strong>
											<span>current public actor fact</span>
										</span>
									</li>
									<li class="trace-step">
										<i class="trace-marker" />
										<span class="trace-copy">
											<strong>
												{context.activeArtifact
													? `Artifact revision ${context.activeArtifact.revision} stored`
													: "Awaiting accepted artifact"}
											</strong>
											<span>semantic nodes, never generated DOM</span>
										</span>
									</li>
									{context.presentation.turn?.capability ? (
										<li class="trace-step capability-proof">
											<i class="trace-marker" />
											<span class="trace-copy">
												<strong>{`${context.presentation.turn.capability.provider} · ${context.presentation.turn.capability.tool}`}</strong>
												<span>
													{capabilityProofSummary(
														context.presentation.turn.capability,
													)}
												</span>
											</span>
										</li>
									) : null}
									{context.presentation.turn?.collision ? (
										<li class="trace-step collision-proof">
											<i class="trace-marker" />
											<span class="trace-copy">
												<strong>Capability manifest collision</strong>
												<span>{`${context.presentation.turn.collision.toolNames.join(", ")} · ${context.presentation.turn.collision.owners.join(" + ")}`}</span>
											</span>
										</li>
									) : null}
								</ol>
							</section>
							<section class="runtime-card">
								<div class="runtime-card-head">
									<strong>Channel projections</strong>
									<span>same component contract</span>
								</div>
								<div class="commit-list">
									<div class="commit">
										<span class="commit-icon">▤</span>
										<span class="commit-copy">
											<strong>Browser · native JSX</strong>
											<span>
												{context.presentation.documentCommit
													? `${context.presentation.documentCommit.id} · revision ${context.presentation.documentCommit.revision}`
													: "awaiting artifact"}
											</span>
										</span>
										<span class="commit-status">
											{context.presentation.documentCommit ? "current" : "idle"}
										</span>
									</div>
									<div class="commit commit-terminal">
										<span class="commit-icon">›_</span>
										<span class="commit-copy">
											<strong>Terminal · Node</strong>
											<span>pnpm demo:terminal · no DOM required</span>
										</span>
										<span class="commit-status">headless</span>
									</div>
									<div class="commit commit-speech">
										<span class="commit-icon">◖</span>
										<span class="commit-copy">
											<strong>Speech · audio</strong>
											<span>
												{context.presentation.speechCommit?.text ??
													"browser adapter · actor acknowledged"}
											</span>
										</span>
										<span class="commit-status">
											{context.presentation.speechCommit?.status ?? "idle"}
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
										{workbenchCommandNames.map((name) => (
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
												{workbenchCommandNames.includes("renderJavascript")
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
