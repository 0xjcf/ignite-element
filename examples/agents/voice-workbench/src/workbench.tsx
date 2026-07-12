/** @jsxImportSource ignite-element/jsx */
import type { CompleteResponseInput } from "./domain";
import type { component } from "./session";

type WorkbenchRenderer = Extract<
	Parameters<typeof component>[1],
	(...args: never[]) => unknown
>;
type WorkbenchContext = Parameters<WorkbenchRenderer>[0];
type DocumentNode = WorkbenchContext["documents"][number]["nodes"][number];

const renderNode = (node: DocumentNode, context: WorkbenchContext) => {
	switch (node.kind) {
		case "text":
			return <p key={node.id}>{node.text}</p>;
		case "checklist":
			return (
				<ul key={node.id} aria-label="Checklist">
					{node.items.map((item) => (
						<li key={item.id}>
							<label>
								<input type="checkbox" checked={item.checked} disabled />
								{item.label}
							</label>
						</li>
					))}
				</ul>
			);
		case "action": {
			const canComplete =
				node.commandName === "completeResponse" &&
				context.status === "responding" &&
				typeof node.payload === "object" &&
				node.payload !== null &&
				!Array.isArray(node.payload);
			return (
				<button
					key={node.id}
					type="button"
					disabled={!canComplete}
					title={node.description}
					onClick={() => {
						if (canComplete) {
							context.completeResponse(node.payload as CompleteResponseInput);
						}
					}}
				>
					{node.label}
				</button>
			);
		}
		case "form":
			return (
				<fieldset key={node.id}>
					<legend>{node.title ?? "Form"}</legend>
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
								aria-describedby={
									field.description ? `${field.id}-help` : undefined
								}
							/>
							{field.description ? (
								<small id={`${field.id}-help`}>{field.description}</small>
							) : null}
						</label>
					))}
				</fieldset>
			);
		case "table":
			return (
				<table key={node.id}>
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
			);
		case "timeline":
			return (
				<ol key={node.id} aria-label="Timeline">
					{node.events.map((event) => (
						<li key={event.id}>
							<time datetime={event.timestamp}>{event.timestamp}</time>{" "}
							<strong>{event.label}</strong>
							{event.detail ? <p>{event.detail}</p> : null}
						</li>
					))}
				</ol>
			);
		case "chart":
			return (
				<ul key={node.id} aria-label={`${node.chartType} chart data`}>
					{node.series.map((series) => (
						<li key={series.id}>
							{series.label}: {series.value}
						</li>
					))}
				</ul>
			);
		case "code-diff":
			return (
				<figure key={node.id}>
					<figcaption>{node.language ?? "Code"} diff</figcaption>
					<pre>
						<code>{`Before:\n${node.before ?? ""}\nAfter:\n${node.after ?? ""}`}</code>
					</pre>
				</figure>
			);
		case "decision-log":
			return (
				<section key={node.id} aria-label="Decision log">
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

export const renderWorkbench: WorkbenchRenderer = (context) => (
	<main>
		<header>
			<h1>Voice and text artifact workbench</h1>
			{/* biome-ignore lint/a11y/noRedundantRoles lint/a11y/useSemanticElements: igniteTest's DOM bridge currently requires the explicit status role. */}
			<output role="status" aria-label="Conversation status">
				{context.status === "ready" ? "Ready" : "Responding"}
			</output>
		</header>
		<form
			onSubmit={(event: Event) => {
				event.preventDefault();
				const form = event.currentTarget as HTMLFormElement;
				const text = String(new FormData(form).get("prompt") ?? "").trim();
				if (text) context.submitPrompt({ modality: "text", text });
			}}
		>
			<label>
				Prompt
				<textarea name="prompt" disabled={context.status !== "ready"} />
			</label>
			<button type="submit" disabled={context.status !== "ready"}>
				Send text prompt
			</button>
			<button
				type="button"
				disabled={context.status !== "ready"}
				onClick={(event: Event) => {
					const form = (event.currentTarget as HTMLElement).closest("form");
					const text = String(
						form ? (new FormData(form).get("prompt") ?? "") : "",
					).trim();
					if (text) context.submitPrompt({ modality: "speech", text });
				}}
			>
				Send speech prompt
			</button>
		</form>
		<section aria-label="Artifacts">
			{context.documents.map((document) => (
				<article key={document.id}>
					<h2>{document.title ?? document.id}</h2>
					{document.nodes.map((node) => renderNode(node, context))}
				</article>
			))}
		</section>
	</main>
);
