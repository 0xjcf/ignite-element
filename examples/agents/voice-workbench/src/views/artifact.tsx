/** @jsxImportSource ignite-element/jsx */

import type { WorkbenchProjection } from "../workbench-component";

type DocumentNode = WorkbenchProjection["artifacts"][number]["nodes"][number];

const nodeHeading = (kind: DocumentNode["kind"], label: string) => (
	<h2>
		{label}
		<span class="node-kind">{kind}</span>
	</h2>
);

const renderNode = (node: DocumentNode, context: WorkbenchProjection) => {
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
							{node.displayRows.map((row, rowIndex) => (
								<tr key={row.id}>
									{row.cells.map((cell, index) => (
										<td
											key={`${row.id}-${node.columns[index]?.id ?? rowIndex}-${index}`}
											class={cell.tone ? `table-cell-${cell.tone}` : undefined}
										>
											{cell.link ? (
												<a
													class="source-link"
													href={cell.link.href}
													target="_blank"
													rel="noopener noreferrer"
													aria-label={cell.link.ariaLabel}
												>
													<span>{cell.text}</span>
													<span aria-hidden="true">↗</span>
												</a>
											) : (
												cell.text
											)}
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
			const chart = node.chart;
			if (!chart) return null;
			return (
				<figure
					key={node.id}
					class="doc-card"
					data-node-kind={node.kind}
					aria-label={chart.accessibleLabel}
				>
					{nodeHeading(node.kind, `${node.chartType} chart`)}
					{chart.series.map((series) => (
						<label key={series.id}>
							<span>
								{series.label}: {series.value}
							</span>
							<progress
								max={chart.maximum}
								value={series.progressValue}
								aria-label={series.accessibleLabel}
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
						<code>{node.diffText}</code>
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

export const renderArtifactView = (context: WorkbenchProjection) => (
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
							{context.resultQuality ? (
								<section
									class={`result-quality result-quality-${context.resultQuality.tone}`}
									aria-label="Shopper result quality"
									aria-live="polite"
								>
									<header>
										<span class="result-quality-status">
											{context.resultQuality.statusLabel}
										</span>
										<div>
											<h2>{context.resultQuality.heading}</h2>
											<p>{context.resultQuality.summary}</p>
										</div>
									</header>
									<div class="result-quality-metrics">
										{context.resultQuality.metrics.map((metric) => (
											<output key={metric.key}>
												<strong>{metric.value}</strong>
												<span>{metric.label}</span>
											</output>
										))}
									</div>
									<ul class="result-quality-issues">
										{context.resultQuality.issueRows.map((row) => (
											<li key={row.key}>
												<strong>{row.subject}</strong>
												<span>{row.label}</span>
											</li>
										))}
									</ul>
									<div class="result-quality-next">
										<strong>Next steps</strong>
										<ul>
											{context.resultQuality.nextActions.map((action) => (
												<li key={action}>{action}</li>
											))}
										</ul>
									</div>
								</section>
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
									<h1>{context.activeArtifact.displayTitle}</h1>
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
);
