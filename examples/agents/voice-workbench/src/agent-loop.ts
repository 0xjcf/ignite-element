import type { NeutralManifest } from "ignite-element/tools";

const MODEL_COMMANDS = [
	"createArtifact",
	"reviseArtifact",
	"setChecklistItem",
	"completeResponse",
] as const;

type ModelCommand = (typeof MODEL_COMMANDS)[number];

export type ModelToolCall = { id?: string; command: string; input: unknown };
export type ModelToolFeedback = {
	id: string;
	command: string;
	status:
		| "accepted"
		| "actor-rejected"
		| "tool-error"
		| "deferred"
		| "capability-success"
		| "capability-unavailable"
		| "capability-validation"
		| "capability-timeout"
		| "capability-failure";
	ownerId?: string;
	reason?: string;
	issues?: readonly string[];
	providerStatus?: number;
	fact?: unknown;
	receipt?: { provider: string; queryCount?: number; sourceCount?: number };
	view: unknown;
	events: readonly { type: string; reason?: string }[];
};
export type ModelExchange = {
	calls: readonly (ModelToolCall & { id: string })[];
	results: readonly ModelToolFeedback[];
};
export type ModelFailureKind =
	| "configuration"
	| "network"
	| "timeout"
	| "provider"
	| "invalid-response";
export type ModelFailureFact = {
	kind: ModelFailureKind;
	message: string;
	status?: number;
};
export type ModelResult =
	| { ok: true; calls: readonly ModelToolCall[] }
	| { ok: false; error: ModelFailureFact };
export type ModelRequest = {
	prompt: { channel: "text" | "speech"; text: string };
	tools: NeutralManifest;
	view: unknown;
	history: readonly ModelExchange[];
	capabilities: { internetAccess: "available" | "unavailable" };
};
export type ModelTurnTrace = { command: string; accepted: boolean };
export type ModelTurnResult =
	| { accepted: true; trace: ModelTurnTrace[]; exchange: ModelExchange }
	| {
			accepted: false;
			reason: "prompt-rejected" | "response-incomplete";
			trace: ModelTurnTrace[];
			exchange: ModelExchange;
	  }
	| {
			accepted: false;
			reason: "model-failed";
			failure: ModelFailureFact;
			trace: ModelTurnTrace[];
	  }
	| {
			accepted: false;
			reason: "command-not-allowed" | "command-rejected";
			command: string;
			trace: ModelTurnTrace[];
			exchange: ModelExchange;
	  };

const isModelCommand = (name: string): name is ModelCommand =>
	MODEL_COMMANDS.includes(name as ModelCommand);

export const modelTools = (
	manifest: NeutralManifest,
	externalCommands: readonly string[] = [],
): NeutralManifest =>
	manifest.filter(
		(tool) => isModelCommand(tool.name) || externalCommands.includes(tool.name),
	);

const failureMessage = (kind: ModelFailureKind): string => {
	switch (kind) {
		case "configuration":
			return "Configure the local model URL and model name, then try again.";
		case "network":
			return "The local model could not be reached. Check its configuration and try again.";
		case "timeout":
			return "The local model timed out. Try again.";
		case "invalid-response":
			return "The local model returned an invalid response. Try again.";
		case "provider":
			return "The local model could not complete this turn. Try again.";
	}
};

const sanitizedFailure = (
	failure: Pick<ModelFailureFact, "kind" | "status">,
): ModelFailureFact => ({
	kind: failure.kind,
	message: failureMessage(failure.kind),
	...(failure.status === undefined ? {} : { status: failure.status }),
});

const recoveryCall = (message: string): ModelToolCall => ({
	id: "workbench-recovery",
	command: "completeResponse",
	input: { text: message },
});

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const normalizedKey = (value: unknown): string =>
	typeof value === "string"
		? value
				.trim()
				.toLocaleLowerCase()
				.replace(/[^a-z0-9]+/g, "")
		: "";

const completionEvidence = (
	history: readonly ModelExchange[],
): CompletionEvidence[] => {
	const bySubject = new Map<string, CompletionEvidence>();
	for (const exchange of history) {
		for (const result of exchange.results) {
			if (
				result.command !== "searchWeb" ||
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
				const key = normalizedKey(subject);
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
			aliases.includes(normalizedKey(column.id)) ||
			aliases.includes(normalizedKey(column.label))
		);
	});

const boundedIssues = (issues: readonly string[]): string[] =>
	issues.slice(0, 8).map((issue) => issue.slice(0, 160));

/**
 * Audits whether accepted semantic nodes faithfully materialize the latest
 * structured external price evidence. It reads only prior model exchanges and
 * the projected actor view; it never mutates the actor or provider facts.
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
					normalizedKey(candidate.cells[subjectIndex]) === fact.key,
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
				normalizedKey(row.cells[statusIndex]) === fact.status;
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

	const chartSeries: Record<string, unknown>[] = nodes.flatMap((node) =>
		node.kind === "chart" && Array.isArray(node.series)
			? node.series.filter(isRecord)
			: [],
	);
	const chartUsesEvidence = chartSeries.some((series) =>
		evidence.some((fact) => normalizedKey(series.label) === fact.key),
	);
	if (chartUsesEvidence) {
		for (const fact of evidence) {
			const series = chartSeries.find(
				(candidate) => normalizedKey(candidate.label) === fact.key,
			);
			if (fact.status === "unverified" && series) {
				issues.push(
					`${fact.subject}: exclude unverified price evidence from numeric charts.`,
				);
			} else if (
				fact.status === "sourced" &&
				(!series || series.value !== fact.amount)
			) {
				issues.push(
					`${fact.subject}: chart the exact sourced numeric price or remove the evidence chart.`,
				);
			}
		}
	}

	return issues.length === 0
		? { ok: true }
		: { ok: false, issues: boundedIssues(issues) };
};

/**
 * A pure protocol for one model round. Exactly one proposed tool call executes
 * before the model observes its result. Sibling calls receive deferred results,
 * which keeps the provider transcript valid while preventing an artifact
 * mutation and completion from being accepted in the same unobserved round.
 */
export function* modelTurn(
	response: ModelResult,
): Generator<ModelToolCall, ModelTurnResult, ModelToolFeedback> {
	const trace: ModelTurnTrace[] = [];
	if (!response.ok) {
		const failure = sanitizedFailure(response.error);
		const feedback = yield recoveryCall(failure.message);
		const accepted = feedback.status === "accepted";
		trace.push({ command: "completeResponse", accepted });
		return {
			accepted: false,
			reason: "model-failed",
			failure,
			trace,
		};
	}
	const calls = response.calls.map((call, index) => ({
		...call,
		id: call.id?.trim() || `model-call-${index}`,
	}));
	const mutation = calls.find(
		(call) =>
			call.command === "createArtifact" ||
			call.command === "reviseArtifact" ||
			call.command === "setChecklistItem",
	);
	const externalEvidence = calls.find((call) => !isModelCommand(call.command));
	const primary = externalEvidence ?? mutation ?? calls[0];
	if (!primary) {
		return {
			accepted: false,
			reason: "response-incomplete",
			trace,
			exchange: { calls, results: [] },
		};
	}

	const primaryIsMutation =
		primary.command === "createArtifact" ||
		primary.command === "reviseArtifact" ||
		primary.command === "setChecklistItem";
	const feedback = yield primary;
	const capabilityFeedback = feedback.status.startsWith("capability-");
	const callAccepted =
		feedback.status === "accepted" || feedback.status === "capability-success";
	trace.push({ command: primary.command, accepted: callAccepted });
	const results = calls.map((call): ModelToolFeedback => {
		if (call.id === primary.id) {
			return {
				...feedback,
				id: call.id,
				command: call.command,
			};
		}
		return {
			id: call.id,
			command: call.command,
			status: "deferred",
			reason: primaryIsMutation
				? "observe-artifact-mutation-before-continuing"
				: "observe-tool-result-before-continuing",
			view: feedback.view,
			events: [],
		};
	});
	const exchange = { calls, results };

	if (!isModelCommand(primary.command) && !capabilityFeedback) {
		return {
			accepted: false,
			reason: "command-not-allowed",
			command: primary.command,
			trace,
			exchange,
		};
	}
	if (capabilityFeedback) {
		return {
			accepted: false,
			reason: "response-incomplete",
			trace,
			exchange,
		};
	}

	if (!callAccepted) {
		return {
			accepted: false,
			reason: "command-rejected",
			command: primary.command,
			trace,
			exchange,
		};
	}

	if (
		primaryIsMutation ||
		calls.length > 1 ||
		primary.command !== "completeResponse"
	) {
		return {
			accepted: false,
			reason: "response-incomplete",
			trace,
			exchange,
		};
	}

	return { accepted: true, trace, exchange };
}
