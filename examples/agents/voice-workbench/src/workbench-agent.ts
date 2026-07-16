import { igniteTools, isOk } from "ignite-element/tools";
import {
	type ModelExchange,
	type ModelToolFeedback,
	type ModelTurnResult,
	modelTools,
	normalizeModelIssues,
} from "./agent-loop";
import {
	type CapabilityExecutionFact,
	type CapabilityFallbackAttempt,
	type CapabilityFederation,
	type CapabilityOwner,
	type CapabilityRetryFact,
	createCapabilityFederation,
	runCapability,
} from "./capability-federation";
import { PRODUCT_PRICE_REASON_CODES } from "./domains/product-pricing/price-capability";
import { type DomainRegistry, emptyDomainRegistry } from "./domains/registry";
import {
	type MlxWorkbenchConfiguration,
	requestMlxWorkbenchModel,
} from "./model";
import {
	createModelTurnActor,
	type ModelTurnPortRequest,
	projectModelTurnLifecycle,
	projectModelTurnPortRequest,
	projectModelTurnTerminalFact,
} from "./model-turn";
import {
	component,
	recordCapabilityOutcome,
	recordDomainPolicyDecision,
	recordModelTurnLifecycle,
	recordRuntimeManifest,
	recordTurn,
	recordTurnTerminal,
	type WorkbenchCapabilityProof,
	type WorkbenchCollisionProof,
	type WorkbenchPricingProofRow,
	type WorkbenchTurnFact,
} from "./session";

const EXTERNAL_EVIDENCE_TOOL_NAMES = new Set(["searchWeb", "priceProducts"]);

type TurnProof = {
	capability?: WorkbenchCapabilityProof;
	collision?: WorkbenchCollisionProof;
};

const toTurnFact = (
	result: ModelTurnResult,
	proof: TurnProof,
): WorkbenchTurnFact => {
	if (result.accepted) {
		return { type: "accepted", trace: result.trace, ...proof };
	}
	if (result.reason === "model-failed") {
		return {
			type: "model-failed",
			failureKind: result.failure.kind,
			message: result.failure.message,
			trace: result.trace,
			...proof,
		};
	}
	if (!("command" in result)) {
		return { type: result.reason, trace: result.trace, ...proof };
	}
	return {
		type: result.reason,
		command: result.command,
		trace: result.trace,
		...proof,
	};
};

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

const boundedText = (value: string, maximum = 160): string =>
	value.trim().slice(0, maximum);

const boundedProofText = (
	value: unknown,
	maximum: number,
): string | undefined => {
	if (typeof value !== "string") return undefined;
	const text = boundedText(value, maximum);
	return text || undefined;
};

const PRICING_STATUSES = ["sourced", "unverified"] as const;
const PRICING_CACHE_STATUSES = ["miss", "hit", "coalesced"] as const;
const PRICING_NATIVE_STATUSES = [
	"hit",
	"miss",
	"schema-drift",
	"transport-error",
	"coalesced",
	"not-needed",
] as const;
const PRICING_BRAVE_STATUSES = [
	"not-needed",
	"not-configured",
	"not-eligible",
	"attempted-success",
	"attempted-miss",
	"attempted-failure",
	"coalesced",
] as const;

const boundedEnum = <Values extends readonly string[]>(
	value: unknown,
	allowed: Values,
): Values[number] | undefined =>
	typeof value === "string" && allowed.includes(value)
		? (value as Values[number])
		: undefined;

const pricingProofRows = (
	execution: CapabilityExecutionFact,
): readonly WorkbenchPricingProofRow[] | undefined => {
	if (
		execution.type !== "success" ||
		execution.toolName !== "priceProducts" ||
		!isRecord(execution.data) ||
		!Array.isArray(execution.data.searches)
	) {
		return undefined;
	}

	const rows = execution.data.searches
		.slice(0, 8)
		.flatMap<WorkbenchPricingProofRow>((candidate) => {
			if (
				!isRecord(candidate) ||
				!isRecord(candidate.price) ||
				!isRecord(candidate.receipt)
			) {
				return [];
			}
			const subject = boundedProofText(candidate.subject, 120);
			const priceStatus = boundedEnum(candidate.price.status, PRICING_STATUSES);
			const reasonCode = boundedEnum(
				candidate.price.reasonCode,
				PRODUCT_PRICE_REASON_CODES,
			);
			const reason = boundedProofText(candidate.price.reason, 240);
			const cacheStatus = boundedEnum(
				candidate.receipt.cache,
				PRICING_CACHE_STATUSES,
			);
			const nativeStatus = boundedEnum(
				candidate.receipt.native,
				PRICING_NATIVE_STATUSES,
			);
			const braveStatus = boundedEnum(
				candidate.receipt.brave,
				PRICING_BRAVE_STATUSES,
			);
			if (
				!subject ||
				!priceStatus ||
				(priceStatus === "unverified" && (!reasonCode || !reason)) ||
				!cacheStatus ||
				!nativeStatus ||
				!braveStatus
			) {
				return [];
			}
			const product = isRecord(candidate.selection)
				? boundedProofText(candidate.selection.product, 160)
				: undefined;
			const size = isRecord(candidate.selection)
				? boundedProofText(candidate.selection.size, 80)
				: undefined;
			const row = {
				subject,
				...(product && size ? { product, size } : {}),
				cacheStatus,
				nativeStatus,
				braveStatus,
			};
			return priceStatus === "unverified"
				? [
						{
							...row,
							priceStatus,
							reasonCode: reasonCode as NonNullable<typeof reasonCode>,
							reason: reason as string,
						},
					]
				: [{ ...row, priceStatus }];
		});
	return rows.length > 0 ? rows : undefined;
};

const boundedCount = (value: number | undefined): number | undefined =>
	typeof value === "number" && Number.isFinite(value) && value >= 0
		? Math.min(Math.floor(value), 999)
		: undefined;

const boundedStatus = (value: number | undefined): number | undefined =>
	typeof value === "number" &&
	Number.isInteger(value) &&
	value >= 100 &&
	value <= 599
		? value
		: undefined;

const boundedRetry = (
	retry: CapabilityRetryFact | undefined,
): WorkbenchCapabilityProof["retry"] =>
	retry
		? {
				attempts: Math.min(Math.max(Math.floor(retry.attempts), 1), 4),
				maxAttempts: Math.min(Math.max(Math.floor(retry.maxAttempts), 1), 4),
				...(typeof retry.retryAfterMs === "number" &&
				Number.isFinite(retry.retryAfterMs)
					? {
							retryAfterMs: Math.min(
								Math.max(Math.floor(retry.retryAfterMs), 0),
								10_000,
							),
						}
					: {}),
				exhausted: retry.exhausted,
			}
		: undefined;

const boundedFallback = (
	fallback: CapabilityFallbackAttempt | undefined,
): CapabilityFallbackAttempt | undefined => {
	if (
		!fallback ||
		typeof fallback.from !== "string" ||
		typeof fallback.provider !== "string" ||
		(fallback.outcome !== "success" &&
			fallback.outcome !== "failure" &&
			fallback.outcome !== "timeout" &&
			fallback.outcome !== "threw")
	) {
		return undefined;
	}
	const status = boundedStatus(fallback.status);
	if (status === undefined) return undefined;
	return {
		from: boundedText(fallback.from, 80),
		provider: boundedText(fallback.provider, 80),
		status,
		outcome: fallback.outcome,
	};
};

const capabilityProof = (
	execution: CapabilityExecutionFact,
): WorkbenchCapabilityProof | null => {
	if (execution.ownerId === "workbench-component") return null;
	const provider =
		execution.type === "success"
			? execution.receipt.provider
			: execution.ownerId;
	const fallback = boundedFallback(
		execution.type === "success"
			? execution.receipt.fallback
			: execution.fallback,
	);
	const pricingRows = pricingProofRows(execution);
	return {
		provider: boundedText(provider, 80),
		tool: boundedText(execution.toolName, 80),
		outcome: execution.type,
		...(execution.type === "success"
			? {
					...(boundedCount(execution.receipt.queryCount) === undefined
						? {}
						: { queryCount: boundedCount(execution.receipt.queryCount) }),
					...(boundedCount(execution.receipt.sourceCount) === undefined
						? {}
						: { sourceCount: boundedCount(execution.receipt.sourceCount) }),
					...(execution.receipt.cache
						? {
								cacheStatus: execution.receipt.cache.status,
								cacheTtlMs: Math.min(
									Math.max(Math.floor(execution.receipt.cache.ttlMs), 0),
									300_000,
								),
							}
						: {}),
				}
			: {
					...(boundedStatus(execution.status) === undefined
						? {}
						: { status: boundedStatus(execution.status) }),
					...(boundedRetry(execution.retry)
						? { retry: boundedRetry(execution.retry) }
						: {}),
				}),
		...(fallback ? { fallback } : {}),
		...(pricingRows ? { pricingRows } : {}),
	};
};

const collisionProof = (
	toolNames: readonly string[],
	owners: readonly string[],
): WorkbenchCollisionProof => ({
	outcome: "collision",
	toolNames: toolNames.slice(0, 8).map((name) => boundedText(name, 80)),
	owners: owners.slice(0, 8).map((owner) => boundedText(owner, 80)),
});

const readEvents = (value: unknown): { type: string; reason?: string }[] => {
	if (!Array.isArray(value)) return [];
	return value.flatMap((event) => {
		if (!isRecord(event) || typeof event.type !== "string") return [];
		return [
			{
				type: event.type,
				...(typeof event.reason === "string" ? { reason: event.reason } : {}),
			},
		];
	});
};

const capabilityFeedback = (
	execution: CapabilityExecutionFact,
	id: string,
): ModelToolFeedback => {
	if (execution.type === "success") {
		if (execution.ownerId === "workbench-component") {
			const data = isRecord(execution.data) ? execution.data : {};
			return {
				id,
				command: execution.toolName,
				ownerId: execution.ownerId,
				status: "accepted",
				view: data.view ?? component.getView().modelContext,
				events: readEvents(data.events),
			};
		}
		const proof = capabilityProof(execution);
		return {
			id,
			command: execution.toolName,
			ownerId: execution.ownerId,
			status: "capability-success",
			fact: execution.data,
			receipt: {
				provider: proof?.provider ?? "external-capability",
				...(proof?.queryCount === undefined
					? {}
					: { queryCount: proof.queryCount }),
				...(proof?.sourceCount === undefined
					? {}
					: { sourceCount: proof.sourceCount }),
				...(proof?.cacheStatus && proof.cacheTtlMs !== undefined
					? {
							cache: {
								status: proof.cacheStatus,
								ttlMs: proof.cacheTtlMs,
							},
						}
					: {}),
				...(proof?.fallback
					? {
							fallback: proof.fallback,
						}
					: {}),
			},
			view: component.getView().modelContext,
			events: [],
		};
	}

	if (execution.ownerId === "workbench-component") {
		return {
			id,
			command: execution.toolName,
			ownerId: execution.ownerId,
			status: execution.actorRejected ? "actor-rejected" : "tool-error",
			reason: execution.reason ?? execution.type,
			...(execution.issues
				? { issues: normalizeModelIssues(execution.issues) }
				: {}),
			view: component.getView().modelContext,
			events: [],
		};
	}

	const status: ModelToolFeedback["status"] =
		execution.type === "unavailable"
			? "capability-unavailable"
			: execution.type === "validation"
				? "capability-validation"
				: execution.type === "timeout"
					? "capability-timeout"
					: "capability-failure";
	const reason = boundedText(execution.message, 300);
	const issues = execution.issues
		? normalizeModelIssues(execution.issues)
		: undefined;
	const providerStatus = boundedStatus(execution.status);
	const proof = capabilityProof(execution);
	return {
		id,
		command: execution.toolName,
		ownerId: execution.ownerId,
		status,
		reason,
		...(issues ? { issues } : {}),
		...(providerStatus === undefined ? {} : { providerStatus }),
		fact: {
			type: execution.type,
			message: reason,
			...(providerStatus === undefined ? {} : { status: providerStatus }),
			...(boundedRetry(execution.retry)
				? { retry: boundedRetry(execution.retry) }
				: {}),
			...(proof?.fallback ? { fallback: proof.fallback } : {}),
		},
		view: component.getView().modelContext,
		events: [],
	};
};

export const MODEL_TURN_TIMEOUT_MS = 45_000;

export type ModelTurnHandle = {
	turnId: string;
	done: Promise<ModelTurnResult | null>;
	cancel: () => void;
	timeout: () => void;
	dispose: () => void;
};

export type ModelTurnStartOptions = {
	timeoutMs?: number;
	signal?: AbortSignal;
};

type ModelTurnActorControl = {
	cancel: () => void;
	timeout: () => void;
};

const resolveSubmittedTurnId = (event: {
	turnId?: string;
	modality: "text" | "speech";
	text: string;
}): string => {
	const currentFact = component.getSnapshot().context.lastFact;
	return (
		event.turnId ??
		(currentFact?.type === "prompt-submitted" ? currentFact.turnId : null) ??
		`${component.getSnapshot().context.sessionId}:${component.getSnapshot().context.revision}`
	);
};

const cancelledComponentExecution = (
	toolName: string,
): CapabilityExecutionFact => ({
	type: "timeout",
	ownerId: "workbench-component",
	toolName,
	message: "The component command was cancelled.",
});

const runSubmittedPrompt = async (
	configuration: MlxWorkbenchConfiguration,
	event: { turnId?: string; modality: "text" | "speech"; text: string },
	externalCapabilities: readonly CapabilityOwner[],
	domains: DomainRegistry,
	signal: AbortSignal,
	bindControl: (control: ModelTurnActorControl) => void,
): Promise<ModelTurnResult | null> => {
	const prompt = { channel: event.modality, text: event.text };
	const turnId = resolveSubmittedTurnId(event);
	let currentCapability: WorkbenchCapabilityProof | undefined;
	let currentCollision: WorkbenchCollisionProof | undefined;
	let routing: CapabilityFederation | null = null;
	const actor = createModelTurnActor({ turnId, prompt });
	const scheduledRequests = new Set<string>();
	const isLive = (
		correlation: { turnId: string; attemptId: string },
		allowTerminal = false,
	): boolean => {
		if (signal.aborted) return false;
		const childSnapshot = actor.getSnapshot();
		if (
			childSnapshot.context.turnId !== correlation.turnId ||
			childSnapshot.context.attemptId !== correlation.attemptId ||
			(!allowTerminal && projectModelTurnTerminalFact(childSnapshot))
		) {
			return false;
		}
		const parentSnapshot = component.getSnapshot();
		const projectedChild = parentSnapshot.context.childLifecycles.modelTurn;
		return (
			parentSnapshot.context.activeTurnId === correlation.turnId &&
			projectedChild?.turnId === correlation.turnId &&
			projectedChild.attemptId === correlation.attemptId
		);
	};

	const executeComponentCall = (
		history: readonly ModelExchange[],
		correlation: { turnId: string; attemptId: string },
	): CapabilityOwner => {
		const tools = igniteTools(component);
		return {
			id: "workbench-component",
			manifest: modelTools(tools.manifest),
			run: async (call, callSignal): Promise<CapabilityExecutionFact> => {
				if (callSignal?.aborted || !isLive(correlation)) {
					return cancelledComponentExecution(call.name);
				}
				if (call.name === "completeResponse") {
					const view = component.getView().modelContext;
					const audits = [
						domains.auditCompletion({ prompt, history, view }),
						auditCompletionEvidence(history, view),
					];
					const issues = normalizeModelIssues(
						audits.flatMap((audit) => (audit.ok ? [] : audit.issues)),
					);
					if (issues.length > 0) {
						return {
							type: "validation",
							ownerId: "workbench-component",
							toolName: call.name,
							message:
								"The accepted artifact does not yet materialize the researched evidence.",
							reason: "evidence-incomplete",
							issues,
							actorRejected: true,
						};
					}
				}
				if (callSignal?.aborted || !isLive(correlation)) {
					return cancelledComponentExecution(call.name);
				}
				const materializedCall = domains.materializeArtifact({
					prompt,
					history,
					view: component.getView().modelContext,
					call,
				});
				if (callSignal?.aborted || !isLive(correlation)) {
					return cancelledComponentExecution(call.name);
				}
				const execution = await tools.run({
					...materializedCall,
					input: normalizeSemanticArtifactIdentity(
						materializedCall.name,
						materializedCall.input,
					),
				});
				if (callSignal?.aborted || !isLive(correlation)) {
					return cancelledComponentExecution(call.name);
				}
				if (!isOk(execution)) {
					switch (execution.error.kind) {
						case "InvalidInput":
							return {
								type: "validation",
								ownerId: "workbench-component",
								toolName: call.name,
								message: "The component command input is invalid.",
								reason: execution.error.kind,
								issues: normalizeModelIssues(execution.error.issues),
							};
						case "Unavailable":
							return {
								type: "unavailable",
								ownerId: "workbench-component",
								toolName: call.name,
								message: "The component command is unavailable.",
								reason: execution.error.kind,
							};
						case "UnknownCommand":
						case "ExecuteFailed":
							return {
								type: "provider-failure",
								ownerId: "workbench-component",
								toolName: call.name,
								message: "The component could not execute the command.",
								reason: execution.error.kind,
							};
					}
				}
				const rejectedByActor = execution.value.events.find(
					(actorEvent) => actorEvent.type === "artifact-rejected",
				);
				if (rejectedByActor) {
					return {
						type: "validation",
						ownerId: "workbench-component",
						toolName: call.name,
						message: "The actor rejected the proposed command.",
						reason:
							"reason" in rejectedByActor
								? String(rejectedByActor.reason)
								: "actor-rejected",
						...("issues" in rejectedByActor && rejectedByActor.issues
							? { issues: normalizeModelIssues(rejectedByActor.issues) }
							: {}),
						actorRejected: true,
					};
				}
				return {
					type: "success",
					ownerId: "workbench-component",
					toolName: call.name,
					data: {
						view: component.getView().modelContext,
						events: execution.value.events.map((actorEvent) => ({
							type: actorEvent.type,
							...("reason" in actorEvent
								? { reason: String(actorEvent.reason) }
								: {}),
						})),
					},
					receipt: { provider: "ignite-component" },
				};
			},
		};
	};

	const recordExecution = (
		execution: CapabilityExecutionFact,
		correlation: { turnId: string; attemptId: string },
	): ModelToolFeedback | null => {
		if (!isLive(correlation)) return null;
		const proof = capabilityProof(execution);
		if (proof) currentCapability = proof;
		const domainDecision = domains.projectExecution(execution);
		if (domainDecision) {
			if (!isLive(correlation)) return null;
			recordDomainPolicyDecision(domainDecision, correlation);
		}
		if (execution.ownerId !== "workbench-component") {
			if (!isLive(correlation)) return null;
			recordCapabilityOutcome(
				{
					type: execution.type,
					ownerId: execution.ownerId,
					toolName: execution.toolName,
					message:
						execution.type === "success"
							? `${execution.receipt.provider} completed the capability.`
							: execution.message,
					...(execution.type !== "success" && execution.status !== undefined
						? { status: execution.status }
						: {}),
					...(proof?.retry ? { retry: proof.retry } : {}),
					...(proof?.cacheStatus
						? {
								cacheStatus: proof.cacheStatus,
								cacheTtlMs: proof.cacheTtlMs,
							}
						: {}),
					...(proof?.fallback ? { fallback: proof.fallback } : {}),
					...(proof?.pricingRows ? { pricingRows: proof.pricingRows } : {}),
				},
				correlation,
			);
		}
		return {
			...capabilityFeedback(execution, execution.toolName),
			attemptId: correlation.attemptId,
		};
	};

	const drivePortRequest = async (request: ModelTurnPortRequest) => {
		const correlation = {
			turnId: request.turnId,
			attemptId: request.attemptId,
		};
		if (!isLive(correlation)) return;
		switch (request.type) {
			case "request-model": {
				const federation = createCapabilityFederation([
					executeComponentCall(request.history, correlation),
					...domains.capabilities,
					...externalCapabilities,
				]);
				if (!federation.ok) {
					currentCollision = collisionProof(
						federation.error.toolNames,
						federation.error.owners,
					);
					const names =
						currentCollision.toolNames.join(", ") || "unknown tools";
					if (!isLive(correlation)) return;
					actor.send({
						type: "PORT_FAILED",
						turnId: request.turnId,
						attemptId: request.attemptId,
						failure: {
							kind: "configuration",
							message: `Capability configuration rejected duplicate tool names: ${names}.`,
						},
					});
					return;
				}
				routing = federation;
				const modelManifest = domains.manifestForExecution({
					prompt: request.prompt,
					history: request.history,
					manifest: federation.manifest,
				});
				const applicableDomainEvidenceAvailable = domains.packs.some(
					(pack) =>
						pack.appliesTo(request.prompt.text) &&
						pack.capabilities.some((capability) =>
							capability.manifest.some((tool) =>
								EXTERNAL_EVIDENCE_TOOL_NAMES.has(tool.name),
							),
						),
				);
				if (!isLive(correlation)) return;
				recordRuntimeManifest(
					modelManifest.map((tool) => ({
						...tool,
						ownerId: federation.ownerByTool.get(tool.name)?.id ?? "federation",
					})),
					correlation,
				);
				if (!isLive(correlation)) return;
				const response = await requestMlxWorkbenchModel(
					configuration,
					{
						prompt: request.prompt,
						tools: modelManifest,
						view: component.getView().modelContext,
						history: request.history,
						domainPolicyInstructions: domains.modelInstructions,
						capabilities: {
							internetAccess:
								modelManifest.some((tool) =>
									EXTERNAL_EVIDENCE_TOOL_NAMES.has(tool.name),
								) || applicableDomainEvidenceAvailable
									? "available"
									: "unavailable",
						},
					},
					signal,
				);
				if (!isLive(correlation)) return;
				actor.send({
					type: "MODEL_RESOLVED",
					turnId: request.turnId,
					attemptId: request.attemptId,
					result: response,
				});
				return;
			}
			case "authorize-call": {
				if (!isLive(correlation)) return;
				const call = {
					id: request.call.id,
					name: request.call.command,
					input: request.call.input,
				};
				const execution = domains.authorizeExecution({
					prompt: request.prompt,
					history: request.history,
					call,
				});
				if (!execution) {
					if (!isLive(correlation)) return;
					actor.send({
						type: "AUTHORIZATION_RESOLVED",
						turnId: request.turnId,
						attemptId: request.attemptId,
						allowed: true,
					});
					return;
				}
				const feedback = recordExecution(execution, correlation);
				if (!feedback || !isLive(correlation)) return;
				actor.send({
					type: "AUTHORIZATION_RESOLVED",
					turnId: request.turnId,
					attemptId: request.attemptId,
					allowed: false,
					feedback,
				});
				return;
			}
			case "execute-call": {
				if (!isLive(correlation)) return;
				if (!routing) {
					actor.send({
						type: "PORT_FAILED",
						turnId: request.turnId,
						attemptId: request.attemptId,
						failure: {
							kind: "configuration",
							message: "Capability routing was unavailable for this turn.",
						},
					});
					return;
				}
				const execution = await runCapability(
					routing,
					{
						id: request.call.id,
						name: request.call.command,
						input: request.call.input,
					},
					signal,
				);
				if (!isLive(correlation)) return;
				const feedback = recordExecution(execution, correlation);
				if (!feedback || !isLive(correlation)) return;
				actor.send({
					type: "CAPABILITY_RESOLVED",
					turnId: request.turnId,
					attemptId: request.attemptId,
					feedback,
				});
			}
		}
	};

	let resolveTerminal!: () => void;
	const terminalReached = new Promise<void>((resolve) => {
		resolveTerminal = resolve;
	});
	const subscription = actor.subscribe((snapshot) => {
		recordModelTurnLifecycle(projectModelTurnLifecycle(snapshot));
		if (projectModelTurnTerminalFact(snapshot)) {
			resolveTerminal();
			return;
		}
		const request = projectModelTurnPortRequest(snapshot);
		if (!request) return;
		if (!isLive({ turnId: request.turnId, attemptId: request.attemptId })) {
			return;
		}
		const requestKey = `${request.type}:${request.attemptId}`;
		if (scheduledRequests.has(requestKey)) return;
		scheduledRequests.add(requestKey);
		void drivePortRequest(request).catch(() => {
			if (!isLive({ turnId: request.turnId, attemptId: request.attemptId })) {
				return;
			}
			actor.send({
				type: "PORT_FAILED",
				turnId: request.turnId,
				attemptId: request.attemptId,
				failure: {
					kind: "provider",
					message: "A turn port failed unexpectedly.",
				},
			});
		});
	});
	bindControl({
		cancel: () => actor.send({ type: "CANCEL", turnId }),
		timeout: () => actor.send({ type: "TIMEOUT", turnId }),
	});
	actor.start();
	await terminalReached;
	const finalSnapshot = actor.getSnapshot();
	const terminal = projectModelTurnTerminalFact(finalSnapshot);
	const result = finalSnapshot.context.lastResult;
	const correlation = {
		turnId,
		attemptId: finalSnapshot.context.attemptId,
	};
	subscription.unsubscribe();
	actor.stop();

	if (result && isLive(correlation, true)) {
		recordTurn(
			toTurnFact(result, {
				...(currentCapability ? { capability: currentCapability } : {}),
				...(currentCollision ? { collision: currentCollision } : {}),
			}),
			correlation,
		);
	}
	if (
		result?.accepted &&
		event.modality === "text" &&
		isLive(correlation, true)
	) {
		await component.execute({ command: "changeDraft", input: "" });
	}
	const parentStillOwnsTurn =
		component.getSnapshot().context.activeTurnId === turnId &&
		component.getSnapshot().context.childLifecycles.modelTurn?.attemptId ===
			correlation.attemptId;
	if (terminal && parentStillOwnsTurn) recordTurnTerminal(terminal);
	if (!result || signal.aborted || !parentStillOwnsTurn) return null;
	return result;
};

export const startSubmittedPrompt = (
	configuration: MlxWorkbenchConfiguration,
	event: { turnId?: string; modality: "text" | "speech"; text: string },
	externalCapabilities: readonly CapabilityOwner[] = [],
	domains: DomainRegistry = emptyDomainRegistry,
	options: ModelTurnStartOptions = {},
): ModelTurnHandle => {
	const turnId = resolveSubmittedTurnId(event);
	const controller = new AbortController();
	let actorControl: ModelTurnActorControl | null = null;
	let terminalIntent: "cancel" | "timeout" | null = null;
	let settled = false;
	const requestTerminal = (intent: "cancel" | "timeout") => {
		if (settled || terminalIntent) return;
		terminalIntent = intent;
		actorControl?.[intent]();
		controller.abort(intent);
	};
	const onExternalAbort = () => {
		const reason = options.signal?.reason;
		requestTerminal(
			reason === "timeout" ||
				(reason instanceof DOMException && reason.name === "TimeoutError")
				? "timeout"
				: "cancel",
		);
	};
	const run = runSubmittedPrompt(
		configuration,
		{ ...event, turnId },
		externalCapabilities,
		domains,
		controller.signal,
		(control) => {
			actorControl = control;
			if (terminalIntent) control[terminalIntent]();
		},
	);
	const timeoutMs = options.timeoutMs ?? MODEL_TURN_TIMEOUT_MS;
	const timeout = Number.isFinite(timeoutMs)
		? setTimeout(() => requestTerminal("timeout"), Math.max(0, timeoutMs))
		: null;
	options.signal?.addEventListener("abort", onExternalAbort, { once: true });
	if (options.signal?.aborted) onExternalAbort();
	const done = run.finally(() => {
		settled = true;
		if (timeout !== null) clearTimeout(timeout);
		options.signal?.removeEventListener("abort", onExternalAbort);
	});
	return {
		turnId,
		done,
		cancel: () => requestTerminal("cancel"),
		timeout: () => requestTerminal("timeout"),
		dispose: () => requestTerminal("cancel"),
	};
};

export const completeSubmittedPrompt = (
	configuration: MlxWorkbenchConfiguration,
	event: { turnId?: string; modality: "text" | "speech"; text: string },
	externalCapabilities: readonly CapabilityOwner[] = [],
	domains: DomainRegistry = emptyDomainRegistry,
	signal?: AbortSignal,
): Promise<ModelTurnResult | null> =>
	startSubmittedPrompt(configuration, event, externalCapabilities, domains, {
		signal,
	}).done;
