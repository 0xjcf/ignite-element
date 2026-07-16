/** @jsxImportSource ignite-element/jsx */

import { type WorkbenchProjection, workbenchCommandNames } from "./session";
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
									<strong>Completing the authorized turn</strong>
									<span>Actor state: {context.turnState}</span>
									<div class="progress-steps">
										<div class="progress-step done">Prompt admitted</div>
										<div class="progress-step done">Current tools derived</div>
										<div
											class={`progress-step${context.respondingProgress.actorOutcomeRecorded ? " done" : ""}`}
										>
											{context.respondingProgress.actorOutcome}
										</div>
										<div class="progress-step active" aria-current="step">
											{context.respondingProgress.pendingResult}
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
									<strong>Live runtime inspector</strong>
									<span>current component view</span>
								</div>
								<div class="component-contract">
									<div class="runtime-fact">
										<span>{context.runtimeInspector.mlx.heading}</span>
										<strong>{context.runtimeInspector.mlx.statusLabel}</strong>
										<small>{context.runtimeInspector.mlx.detail}</small>
									</div>
									<div class="actor-state">
										<div class="state-node" aria-hidden="true">
											◆
										</div>
										<div class="actor-copy">
											<strong>{context.runtimeInspector.actor.heading}</strong>
											<pre class="actor-match">
												<code>{context.runtimeInspector.actor.matchText}</code>
											</pre>
											<output class="latest-fact">
												{context.runtimeInspector.actor.factLabel}
											</output>
										</div>
									</div>
									<div class="capability-outcomes">
										<strong>Capability outcomes</strong>
										{context.runtimeInspector.capabilityRows.map((row) => (
											<output key={row.key} class={row.className}>
												<strong>{row.heading}</strong>
												<span>{row.statusLabel}</span>
												<small>{row.message}</small>
											</output>
										))}
									</div>
									{context.runtimeInspector.domainPolicyCards.map(
										(domainPolicy) => (
											<section
												key="domain-policy"
												class="domain-policy-proof"
												aria-label="Domain policy proof"
											>
												<header>
													<strong>{domainPolicy.heading}</strong>
													<span>{domainPolicy.statusLabel}</span>
												</header>
												<p>{domainPolicy.summary}</p>
												<dl class="domain-policy-identity">
													{domainPolicy.identityRows.map((row) => (
														<div key={row.key}>
															<dt>{row.label}</dt>
															<dd>{row.value}</dd>
														</div>
													))}
												</dl>
												{domainPolicy.sections.map((section) => (
													<section key={section.key} class="domain-policy-list">
														<strong>{section.heading}</strong>
														<ul>
															{section.rows.map((row) => (
																<li key={row.key}>{row.text}</li>
															))}
														</ul>
													</section>
												))}
											</section>
										),
									)}
								</div>
							</section>
							<section class="runtime-card">
								<div class="runtime-card-head">
									<strong>Authorized turn trace</strong>
									<span>model proposes · actor decides</span>
								</div>
								<ol class="turn-trace">
									{context.runtimeInspector.trace.rows.map((row) => (
										<li key={row.key} class={row.className}>
											<i class="trace-marker" />
											<span class="trace-copy">
												<strong>{row.heading}</strong>
												<span>{row.detail}</span>
											</span>
										</li>
									))}
								</ol>
							</section>
							<section class="runtime-card">
								<div class="runtime-card-head">
									<strong>Projection previews</strong>
									<span>same current actor view</span>
								</div>
								<fieldset class="preview-selectors">
									<legend class="sr-only">Projection previews</legend>
									{context.runtimeInspector.preview.selectors.map((preview) => (
										<button
											key={preview.id}
											type="button"
											aria-label={preview.label}
											aria-pressed={preview.selected}
											onClick={() => context.selectRuntimePreview(preview.id)}
										>
											{preview.label}
										</button>
									))}
								</fieldset>
								<pre class="projection-preview">
									{context.runtimeInspector.preview.text}
								</pre>
								<div class="runtime-card-head receipt-head">
									<strong>Commit receipts</strong>
									<span>distinct from previews</span>
								</div>
								<div class="commit-list">
									{context.runtimeInspector.receipts.map((receipt) => (
										<div key={receipt.id} class={receipt.className}>
											<span class="commit-icon">{receipt.icon}</span>
											<span class="commit-copy">
												<strong>{receipt.title}</strong>
												<span>{receipt.detail}</span>
											</span>
											<span class="commit-status">{receipt.statusLabel}</span>
										</div>
									))}
								</div>
							</section>
							<section class="runtime-card">
								<div class="runtime-card-head">
									<strong>Schema explorer</strong>
									<span>manifest ≠ blueprint</span>
								</div>
								<div class="runtime-body">
									<section class="schema-section">
										<header>
											<strong>
												{
													context.runtimeInspector.schemaExplorer.manifest
														.heading
												}
											</strong>
											<span>
												{
													context.runtimeInspector.schemaExplorer.manifest
														.countLabel
												}
											</span>
										</header>
										{context.runtimeInspector.schemaExplorer.manifest.rows.map(
											(row) => (
												<details
													key={row.key}
													data-command-name={row.dataCommandName}
													open
												>
													<summary>
														<strong>{row.name}</strong>
														<span>{row.summaryLabel}</span>
													</summary>
													{row.descriptions.map((description) => (
														<p key={description}>{description}</p>
													))}
													<pre>{row.schemaText}</pre>
												</details>
											),
										)}
									</section>
									<section class="schema-section blueprint">
										<header>
											<strong>
												{
													context.runtimeInspector.schemaExplorer.blueprint
														.heading
												}
											</strong>
											<span>
												{
													context.runtimeInspector.schemaExplorer.blueprint
														.countLabel
												}
											</span>
										</header>
										<div class="command-list">
											{context.runtimeInspector.schemaExplorer.blueprint.rows.map(
												(row) => (
													<details key={row.key} class={row.className}>
														<summary>{row.name}</summary>
														{row.descriptions.map((description) => (
															<p key={description}>{description}</p>
														))}
														<pre>{row.schemaText}</pre>
													</details>
												),
											)}
										</div>
									</section>
									<div class="policy-proof">
										<span aria-hidden="true">◇</span>
										<div>
											<strong>
												{context.runtimeInspector.schemaExplorer.policy.heading}
											</strong>
											<span>
												{context.runtimeInspector.schemaExplorer.policy.result}
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
