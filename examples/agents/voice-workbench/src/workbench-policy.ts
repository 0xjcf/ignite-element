import { type ModelExchange, normalizeModelIssues } from "./agent-loop";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const hasValidIdentity = (value: unknown): value is string =>
	typeof value === "string" && value.trim().length > 0;

const synthesizeIdentity = (
	prefix: string,
	index: number,
	reserved: Set<string>,
): string => {
	const base = `${prefix}-${index + 1}`;
	let candidate = base;
	let suffix = 2;
	while (reserved.has(candidate)) {
		candidate = `${base}-${suffix}`;
		suffix += 1;
	}
	reserved.add(candidate);
	return candidate;
};

const normalizeIdentityCollection = (
	values: readonly unknown[],
	prefix: string,
	normalizeEntry?: (
		entry: Record<string, unknown>,
		index: number,
	) => Record<string, unknown>,
): unknown[] => {
	const reserved = new Set(
		values.flatMap((value) =>
			isRecord(value) && hasValidIdentity(value.id) ? [value.id] : [],
		),
	);
	return values.map((value, index) => {
		if (!isRecord(value)) return value;
		const identity = hasValidIdentity(value.id)
			? value.id
			: synthesizeIdentity(prefix, index, reserved);
		const entry = { ...value, id: identity };
		return normalizeEntry ? normalizeEntry(entry, index) : entry;
	});
};

const normalizeOptionalIdentity = (
	value: unknown,
	identity: string,
): unknown =>
	isRecord(value) && !hasValidIdentity(value.id)
		? { ...value, id: identity }
		: value;

const normalizeNodeIdentity = (
	node: Record<string, unknown>,
	index: number,
): Record<string, unknown> => {
	const prefix = `model-node-${index + 1}`;
	switch (node.kind) {
		case "checklist":
			return Array.isArray(node.items)
				? {
						...node,
						items: normalizeIdentityCollection(node.items, `${prefix}-item`),
					}
				: node;
		case "form":
			return {
				...node,
				...(Array.isArray(node.fields)
					? {
							fields: normalizeIdentityCollection(
								node.fields,
								`${prefix}-field`,
							),
						}
					: {}),
				...(node.submit === undefined
					? {}
					: {
							submit: normalizeOptionalIdentity(
								node.submit,
								`${prefix}-submit`,
							),
						}),
			};
		case "table":
			return {
				...node,
				...(Array.isArray(node.columns)
					? {
							columns: normalizeIdentityCollection(
								node.columns,
								`${prefix}-column`,
							),
						}
					: {}),
				...(Array.isArray(node.rows)
					? {
							rows: normalizeIdentityCollection(node.rows, `${prefix}-row`),
						}
					: {}),
			};
		case "timeline":
			return Array.isArray(node.events)
				? {
						...node,
						events: normalizeIdentityCollection(node.events, `${prefix}-event`),
					}
				: node;
		case "chart":
			return Array.isArray(node.series)
				? {
						...node,
						series: normalizeIdentityCollection(
							node.series,
							`${prefix}-series`,
						),
					}
				: node;
		case "decision-log":
			return Array.isArray(node.entries)
				? {
						...node,
						entries: normalizeIdentityCollection(
							node.entries,
							`${prefix}-entry`,
						),
					}
				: node;
		default:
			return node;
	}
};

export const normalizeSemanticArtifactIdentity = (
	command: string,
	input: unknown,
): unknown => {
	if (
		(command !== "createArtifact" && command !== "reviseArtifact") ||
		!isRecord(input) ||
		!Array.isArray(input.nodes)
	) {
		return input;
	}
	return {
		...input,
		nodes: normalizeIdentityCollection(
			input.nodes,
			"model-node",
			normalizeNodeIdentity,
		),
	};
};

type CompletionEvidence = {
	subject: string;
	key: string;
	status: "sourced" | "unverified";
	amount: number | null;
	sourceUrl: string | null;
};

export type CompletionEvidenceAudit =
	| { ok: true }
	| { ok: false; issues: readonly string[] };

const normalizedEvidenceKey = (value: unknown): string =>
	typeof value === "string"
		? value
				.trim()
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "")
		: "";

const completionEvidence = (
	history: readonly ModelExchange[],
): CompletionEvidence[] => {
	const bySubject = new Map<string, CompletionEvidence>();
	for (const exchange of history) {
		for (const result of exchange.results) {
			if (
				(result.command !== "searchWeb" &&
					result.command !== "priceProducts") ||
				result.status !== "capability-success" ||
				!isRecord(result.fact) ||
				!Array.isArray(result.fact.searches)
			) {
				continue;
			}
			for (const search of result.fact.searches) {
				if (
					!isRecord(search) ||
					typeof search.subject !== "string" ||
					!isRecord(search.price)
				) {
					continue;
				}
				const subject = search.subject.trim();
				const key = normalizedEvidenceKey(subject);
				const status = search.price.status;
				const sourceUrl =
					typeof search.price.sourceUrl === "string"
						? search.price.sourceUrl
						: null;
				if (
					key &&
					status === "sourced" &&
					typeof search.price.amount === "number" &&
					Number.isFinite(search.price.amount) &&
					sourceUrl
				) {
					bySubject.set(key, {
						subject,
						key,
						status,
						amount: search.price.amount,
						sourceUrl,
					});
				} else if (
					key &&
					status === "unverified" &&
					search.price.amount === null
				) {
					bySubject.set(key, {
						subject,
						key,
						status,
						amount: null,
						sourceUrl,
					});
				}
			}
		}
	}
	return [...bySubject.values()];
};

const columnIndex = (
	columns: readonly unknown[],
	aliases: readonly string[],
): number =>
	columns.findIndex((column) => {
		if (!isRecord(column)) return false;
		return (
			aliases.includes(normalizedEvidenceKey(column.id)) ||
			aliases.includes(normalizedEvidenceKey(column.label))
		);
	});

/**
 * Workbench-specific policy for materializing accepted web-search price facts.
 * The generic model-turn protocol remains provider and artifact agnostic.
 */
export const auditCompletionEvidence = (
	history: readonly ModelExchange[],
	view: unknown,
): CompletionEvidenceAudit => {
	const evidence = completionEvidence(history);
	if (evidence.length === 0) return { ok: true };

	const issues: string[] = [];
	if (!isRecord(view) || !Array.isArray(view.artifacts)) {
		return {
			ok: false,
			issues: ["Create an artifact before completing the researched response."],
		};
	}
	const artifacts = view.artifacts.filter(isRecord);
	const activeArtifact =
		(typeof view.activeArtifactId === "string"
			? artifacts.find((artifact) => artifact.id === view.activeArtifactId)
			: undefined) ?? artifacts[artifacts.length - 1];
	const nodes: Record<string, unknown>[] =
		activeArtifact && Array.isArray(activeArtifact.nodes)
			? activeArtifact.nodes.filter(isRecord)
			: [];
	if (nodes.length === 0) {
		return {
			ok: false,
			issues: ["Add semantic artifact nodes before completing the response."],
		};
	}

	const checklistHasPriceLabel = nodes.some(
		(node) =>
			node.kind === "checklist" &&
			Array.isArray(node.items) &&
			node.items.some(
				(item: unknown) =>
					isRecord(item) &&
					typeof item.label === "string" &&
					/(?:US\s*)?[$€£]\s*\d/.test(item.label),
			),
	);
	if (checklistHasPriceLabel) {
		issues.push(
			"Keep researched prices out of checklist labels; use semantic table cells instead.",
		);
	}

	const table = nodes.find((node) => {
		if (node.kind !== "table" || !Array.isArray(node.columns)) return false;
		return (
			columnIndex(node.columns, ["subject", "item", "product"]) >= 0 &&
			columnIndex(node.columns, ["price", "amount", "value"]) >= 0 &&
			columnIndex(node.columns, ["status", "evidencestatus"]) >= 0 &&
			columnIndex(node.columns, ["source", "citation", "url", "sourceurl"]) >= 0
		);
	});
	if (!table || !Array.isArray(table.columns) || !Array.isArray(table.rows)) {
		issues.push(
			"Materialize researched facts in a table with Subject, Price, Status, and Source columns.",
		);
	} else {
		const subjectIndex = columnIndex(table.columns, [
			"subject",
			"item",
			"product",
		]);
		const priceIndex = columnIndex(table.columns, ["price", "amount", "value"]);
		const statusIndex = columnIndex(table.columns, [
			"status",
			"evidencestatus",
		]);
		const sourceIndex = columnIndex(table.columns, [
			"source",
			"citation",
			"url",
			"sourceurl",
		]);
		const rows: Record<string, unknown>[] = table.rows.filter(isRecord);
		for (const fact of evidence) {
			const row = rows.find(
				(candidate) =>
					Array.isArray(candidate.cells) &&
					normalizedEvidenceKey(candidate.cells[subjectIndex]) === fact.key,
			);
			if (!row || !Array.isArray(row.cells)) {
				issues.push(`${fact.subject}: add an exact researched evidence row.`);
				continue;
			}
			const priceMatches =
				fact.status === "sourced"
					? row.cells[priceIndex] === fact.amount
					: row.cells[priceIndex] === null;
			const statusMatches =
				normalizedEvidenceKey(row.cells[statusIndex]) === fact.status;
			const sourceMatches =
				fact.sourceUrl === null
					? row.cells[sourceIndex] === null
					: row.cells[sourceIndex] === fact.sourceUrl;
			if (!priceMatches || !statusMatches || !sourceMatches) {
				issues.push(
					`${fact.subject}: copy the exact Price, Status, and Source from the accepted search evidence.`,
				);
			}
		}
	}

	const charts = nodes.filter((node) => node.kind === "chart");
	const chartSeries: Record<string, unknown>[] = [];
	for (const chart of charts) {
		const series = Array.isArray(chart.series)
			? chart.series.filter(isRecord)
			: [];
		if (series.length === 0) {
			const chartId =
				typeof chart.id === "string" && chart.id.trim()
					? chart.id.trim().slice(0, 60)
					: "Chart";
			issues.push(
				`${chartId}: remove the empty chart or chart exact sourced numeric evidence.`,
			);
		}
		chartSeries.push(...series);
	}
	if (charts.length > 0) {
		for (const series of chartSeries) {
			const fact = evidence.find(
				(candidate) => candidate.key === normalizedEvidenceKey(series.label),
			);
			const label =
				typeof series.label === "string" && series.label.trim()
					? series.label.trim().slice(0, 60)
					: "Unnamed chart series";
			if (!fact) {
				issues.push(
					`${label}: chart series is not accepted sourced search evidence.`,
				);
			} else if (fact.status === "unverified") {
				issues.push(
					`${fact.subject}: exclude unverified price evidence from numeric charts.`,
				);
			} else if (series.value !== fact.amount) {
				issues.push(
					`${fact.subject}: chart the exact sourced numeric price or remove the evidence chart.`,
				);
			}
		}
		for (const fact of evidence) {
			if (
				fact.status === "sourced" &&
				!chartSeries.some(
					(series) => normalizedEvidenceKey(series.label) === fact.key,
				)
			) {
				issues.push(
					`${fact.subject}: include the exact sourced numeric price in the evidence chart.`,
				);
			}
		}
	}

	return issues.length === 0
		? { ok: true }
		: { ok: false, issues: normalizeModelIssues(issues) };
};
