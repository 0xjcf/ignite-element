/** @jsxImportSource ignite-element/jsx */

import type { WorkbenchProjection } from "../workbench-component";

export const renderRuntimeView = (context: WorkbenchProjection) => (
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
);
