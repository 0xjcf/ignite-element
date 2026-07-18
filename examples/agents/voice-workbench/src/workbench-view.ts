import type { CapabilityFallbackAttempt } from "./capability-federation";
import type {
	ConversationFact,
	RestoreArtifactRevisionInput,
	SelectArtifactInput,
	SetChecklistItemInput,
	SubmitPromptInput,
} from "./domain";
import type { DomainPolicyDecision } from "./domains/contracts";
import type { ProductPriceReasonCode } from "./domains/product-pricing/price-capability";
import {
	selectVoiceTranscriptCandidate,
	type VoiceWorkbenchSessionSnapshot,
	type WorkbenchCapabilityOutcome,
	type WorkbenchCapabilityProof,
	type WorkbenchTurnFact,
} from "./session";
import { canStartVoiceCapture, type VoiceCaptureFact } from "./voice";

const describeTurn = (turn: WorkbenchTurnFact | null): string => {
	if (!turn) return "";
	switch (turn.type) {
		case "accepted":
			return "Actor accepted the model-authored turn.";
		case "model-failed":
			return turn.message;
		case "prompt-rejected":
			return "The actor did not admit this prompt.";
		case "response-incomplete":
			return "The model omitted a completed response, so the actor recovered the turn.";
		case "command-not-allowed":
			return `${turn.command} was not allowed by the model command policy.`;
		case "command-rejected":
			return `${turn.command} was rejected by the actor.`;
	}
};

const describeFact = (fact: ConversationFact | null): string => {
	if (!fact) return "no actor facts yet";
	switch (fact.type) {
		case "prompt-submitted":
			return `${fact.type} · ${fact.modality}`;
		case "artifact-created":
		case "artifact-revised":
			return `${fact.type} · revision ${fact.revision}`;
		case "artifact-restored":
			return `${fact.type} · ${fact.fromRevision} → ${fact.revision}`;
		case "artifact-selected":
			return `${fact.type} · ${fact.artifactId}`;
		case "artifact-rejected":
			return `${fact.type} · ${fact.reason}`;
		case "speech-acknowledged":
			return `${fact.type} · ${fact.id}`;
		case "response-completed":
			return fact.type;
	}
};

const fallbackAttemptSummary = (fallback: CapabilityFallbackAttempt): string =>
	`fallback ${fallback.from} → ${fallback.provider} · trigger HTTP ${fallback.status} · ${fallback.outcome}`;

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
		proof.retry === undefined
			? null
			: `${proof.retry.attempts}/${proof.retry.maxAttempts} attempts${proof.retry.retryAfterMs === undefined ? "" : ` · waited ${proof.retry.retryAfterMs}ms`}`,
		proof.cacheStatus === undefined
			? null
			: `cache ${proof.cacheStatus}${proof.cacheTtlMs === undefined ? "" : ` · TTL ${proof.cacheTtlMs}ms`}`,
		proof.fallback === undefined
			? null
			: fallbackAttemptSummary(proof.fallback),
	]
		.filter((value): value is string => value !== null)
		.join(" · ");

const describeRespondingProgress = (
	fact: ConversationFact | null,
): {
	actorOutcome: string;
	actorOutcomeRecorded: boolean;
	pendingResult: string;
} => {
	if (!fact || fact.type === "prompt-submitted") {
		return {
			actorOutcome: "No actor command accepted yet",
			actorOutcomeRecorded: false,
			pendingResult: "Awaiting the first model or capability result",
		};
	}

	switch (fact.type) {
		case "artifact-created":
		case "artifact-revised":
			return {
				actorOutcome: `Actor accepted artifact revision ${fact.revision}`,
				actorOutcomeRecorded: true,
				pendingResult: "Awaiting the next model or capability result",
			};
		case "artifact-restored":
			return {
				actorOutcome: `Actor restored artifact as revision ${fact.revision}`,
				actorOutcomeRecorded: true,
				pendingResult: "Awaiting the next model or capability result",
			};
		case "artifact-rejected":
			return {
				actorOutcome: `Actor rejected the previous command: ${fact.reason}`,
				actorOutcomeRecorded: true,
				pendingResult: "Awaiting a repaired model command",
			};
		case "artifact-selected":
			return {
				actorOutcome: `Actor selected artifact ${fact.artifactId}`,
				actorOutcomeRecorded: true,
				pendingResult: "Awaiting the next model or capability result",
			};
		case "speech-acknowledged":
			return {
				actorOutcome: "Actor acknowledged projected speech",
				actorOutcomeRecorded: true,
				pendingResult: "Awaiting the next model or capability result",
			};
		case "response-completed":
			return {
				actorOutcome: "Actor completed the response",
				actorOutcomeRecorded: true,
				pendingResult: "Completing the authorized turn",
			};
	}
};

const voiceState = (
	fact: VoiceCaptureFact,
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

const runtimePreviewDefinitions = [
	{ id: "browser", label: "Browser preview" },
	{ id: "terminal", label: "Terminal preview" },
	{ id: "speech", label: "Speech preview" },
	{ id: "headless", label: "Headless preview" },
] as const;

const isSchemaRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const schemaType = (schema: Record<string, unknown>): string => {
	if (typeof schema.type === "string") return schema.type;
	if (Array.isArray(schema.enum)) return "enum";
	return "value";
};

const formatSchema = (schema: unknown, rootName = "input"): string => {
	const lines: string[] = [];
	const visit = (
		value: unknown,
		name: string,
		required: boolean,
		depth: number,
	) => {
		if (!isSchemaRecord(value)) return;
		const indent = "  ".repeat(depth);
		lines.push(
			`${indent}${name} · ${schemaType(value)}${required ? " · required" : ""}`,
		);
		for (const constraint of [
			"minLength",
			"maxLength",
			"minimum",
			"maximum",
			"minItems",
			"maxItems",
		] as const) {
			if (typeof value[constraint] === "number") {
				lines.push(`${indent}  ${constraint}: ${value[constraint]}`);
			}
		}
		if (Array.isArray(value.enum)) {
			lines.push(`${indent}  allowed: ${value.enum.join(" | ")}`);
		}
		const requiredNames = new Set(
			Array.isArray(value.required)
				? value.required.filter(
						(entry): entry is string => typeof entry === "string",
					)
				: [],
		);
		if (isSchemaRecord(value.properties)) {
			for (const [propertyName, propertySchema] of Object.entries(
				value.properties,
			)) {
				visit(
					propertySchema,
					propertyName,
					requiredNames.has(propertyName),
					depth + 1,
				);
			}
		}
		if (value.items !== undefined) visit(value.items, "items", true, depth + 1);
	};
	visit(schema, rootName, false, 0);
	return lines.join("\n");
};

const PRODUCT_PRICE_REASON_LABELS: Record<ProductPriceReasonCode, string> = {
	"candidate-ambiguous": "Candidate selection ambiguous",
	"candidate-low-confidence": "Candidate needs clarification",
	"product-not-found": "Product not found",
	"offer-unavailable": "Current offer unavailable",
	"provider-response-invalid": "Provider response invalid",
	"provider-unavailable": "Pricing provider unavailable",
};

const readableArtifactTitle = (
	title: string | undefined,
	id: string,
): string => {
	const value = title?.trim() || id.trim();
	if (!/[-_]/.test(value)) return value;
	return value
		.split(/[-_]+/)
		.filter(Boolean)
		.map((part) => {
			if (part.toLowerCase() === "wholefoods") return "Whole Foods";
			return `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`;
		})
		.join(" ");
};

const tableCellView = (value: unknown, columnLabel: string) => {
	if (typeof value === "string" && value.trim()) {
		const text = value.trim();
		try {
			const url = new URL(text);
			if (url.protocol === "https:" || url.protocol === "http:") {
				const hostname = url.hostname.replace(/^www\./, "");
				return {
					text: hostname,
					link: {
						href: url.href,
						ariaLabel: `Source: ${hostname}`,
					},
				};
			}
		} catch {
			// Ordinary text cells are not links.
		}
		if (text.toLowerCase() === "unverified") {
			return { text: "Unverified", tone: "warning" as const };
		}
		if (text.toLowerCase() === "sourced") {
			return { text: "Verified", tone: "success" as const };
		}
		return { text };
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return { text: String(value) };
	}
	const column = columnLabel.trim().toLowerCase();
	const text =
		column === "price"
			? "Price unavailable"
			: column === "source"
				? "No source"
				: column === "product"
					? "No product matched"
					: "—";
	return { text, tone: "muted" as const };
};

type WorkbenchResultQuality = {
	tone: "success" | "warning" | "needs-input";
	statusLabel: string;
	heading: string;
	summary: string;
	metrics: readonly {
		key: "requested" | "matched" | "verified";
		label: string;
		value: number;
	}[];
	issueRows: readonly { key: string; subject: string; label: string }[];
	nextActions: readonly string[];
};

const productPricingResultQuality = (
	policy: DomainPolicyDecision | null,
	outcomes: readonly WorkbenchCapabilityOutcome[],
): WorkbenchResultQuality | null => {
	if (policy?.domainId !== "product-pricing") return null;
	if (policy.outcome === "needs-input") {
		return {
			tone: "needs-input",
			statusLabel: "Needs input",
			heading: "Pricing needs clarification",
			summary: policy.summary,
			metrics: [],
			issueRows: [],
			nextActions: ["Answer the clarification questions to continue pricing."],
		};
	}
	if (policy.outcome === "rejected") {
		return {
			tone: "warning",
			statusLabel: "Request rejected",
			heading: "Pricing request needs revision",
			summary: policy.summary,
			metrics: [],
			issueRows: [],
			nextActions: ["Revise the request before continuing pricing."],
		};
	}
	const outcome = [...outcomes]
		.reverse()
		.find(
			(candidate) =>
				candidate.ownerId === "product-pricing-price" &&
				candidate.toolName === "priceProducts",
		);
	if (!outcome) return null;
	const rows = outcome.pricingRows ?? [];
	if (rows.length === 0) {
		return {
			tone: "warning",
			statusLabel: "Partial result",
			heading: "Pricing results unavailable",
			summary: "No item-level pricing results were returned.",
			metrics: [],
			issueRows: [],
			nextActions: ["Retry pricing when the provider is available."],
		};
	}
	const requested = rows.length;
	const matched = rows.filter((row) => row.product && row.size).length;
	const verified = rows.filter((row) => row.priceStatus === "sourced").length;
	const issueRows = rows.flatMap((row, index) =>
		row.priceStatus === "unverified"
			? [
					{
						key: `${row.subject}-${index}`,
						subject: row.subject,
						label: PRODUCT_PRICE_REASON_LABELS[row.reasonCode],
					},
				]
			: [],
	);
	const clarificationSubjects = rows
		.filter(
			(row) =>
				row.priceStatus === "unverified" &&
				(row.reasonCode === "candidate-ambiguous" ||
					row.reasonCode === "candidate-low-confidence" ||
					row.reasonCode === "product-not-found"),
		)
		.map((row) => row.subject);
	const hasUnavailableOffer = rows.some(
		(row) =>
			row.priceStatus === "unverified" &&
			row.reasonCode === "offer-unavailable",
	);
	const hasProviderIssue = rows.some(
		(row) =>
			row.priceStatus === "unverified" &&
			(row.reasonCode === "provider-response-invalid" ||
				row.reasonCode === "provider-unavailable"),
	);
	const complete = verified === requested;
	const nextActions = complete
		? ["Review verified prices before shopping."]
		: [
				clarificationSubjects.length > 0
					? `Clarify brand, size, or variety for ${clarificationSubjects.join(", ")}.`
					: null,
				hasUnavailableOffer
					? "Open matched product pages to confirm current availability and price."
					: null,
				hasProviderIssue
					? "Retry pricing when the provider is available."
					: null,
			].filter((action): action is string => action !== null);
	return {
		tone: complete ? "success" : "warning",
		statusLabel: complete ? "Complete result" : "Partial result",
		heading: complete
			? "Shopping list prices verified"
			: verified === 0
				? "Shopping list created; prices unavailable"
				: "Shopping list created with partial pricing",
		summary: `${requested} requested · ${matched} products matched · ${verified} prices verified`,
		metrics: [
			{ key: "requested", label: "requested", value: requested },
			{ key: "matched", label: "matched", value: matched },
			{ key: "verified", label: "verified", value: verified },
		],
		issueRows,
		nextActions:
			nextActions.length > 0
				? nextActions
				: ["Review unverified items before shopping."],
	};
};

export type WorkbenchBlueprintCommands = Record<
	string,
	{
		[key: string]: unknown;
	}
>;

export type VoiceWorkbenchCommandAvailability = {
	acknowledgeSpeech: boolean;
	cancelVoiceCapture: boolean;
	completeResponse: boolean;
	createArtifact: boolean;
	restoreArtifactRevision: boolean;
	reviseArtifact: boolean;
	selectArtifact: boolean;
	setChecklistItem: boolean;
	startVoiceCapture: boolean;
	submitPrompt: boolean;
	submitVoiceTranscript: boolean;
};

export const selectVoiceWorkbenchCommandAvailability = (
	snapshot: VoiceWorkbenchSessionSnapshot,
): VoiceWorkbenchCommandAvailability => {
	const turnIdle = snapshot.matches({ available: { turn: "idle" } });
	const turnResponding = snapshot.matches({
		available: { turn: "responding" },
	});
	const modelAvailable = snapshot.matches("available");
	const hasDocuments = snapshot.context.documents.length > 0;
	const activeArtifact = snapshot.context.documents.find(
		(document) => document.id === snapshot.context.activeArtifactId,
	);
	const hasHistoricalRevision = Boolean(
		activeArtifact &&
			snapshot.context.artifactRevisions.some(
				(document) =>
					document.id === activeArtifact.id &&
					document.revision !== activeArtifact.revision,
			),
	);
	const hasChecklist = snapshot.context.documents.some((document) =>
		document.nodes.some((node) => node.kind === "checklist"),
	);

	return {
		acknowledgeSpeech: snapshot.context.speech?.status === "pending",
		cancelVoiceCapture: turnIdle,
		completeResponse: turnResponding && hasDocuments,
		createArtifact: turnResponding,
		restoreArtifactRevision: turnIdle && hasHistoricalRevision,
		reviseArtifact: turnResponding && hasDocuments,
		selectArtifact: turnIdle && hasDocuments,
		setChecklistItem: modelAvailable && hasChecklist,
		startVoiceCapture:
			turnIdle &&
			canStartVoiceCapture(snapshot.context.childLifecycles.voiceCapture),
		submitPrompt: turnIdle,
		submitVoiceTranscript:
			turnIdle && selectVoiceTranscriptCandidate(snapshot.context) !== null,
	};
};

export const projectVoiceWorkbenchView = ({
	snapshot,
	blueprintCommands = {},
}: {
	snapshot: VoiceWorkbenchSessionSnapshot;
	blueprintCommands?: WorkbenchBlueprintCommands;
}) => {
	const modelPreparing = snapshot.matches("preparing");
	const modelFailed = snapshot.matches("unavailable");
	const modelAvailable = snapshot.matches("available");
	const commandAvailability = selectVoiceWorkbenchCommandAvailability(snapshot);
	const responding = commandAvailability.createArtifact;
	const canSetChecklistItem =
		commandAvailability.setChecklistItem && commandAvailability.submitPrompt;
	const presentation = snapshot.context.presentation;
	const preparedDraft = presentation.draft.trim();
	const submitPromptInput: SubmitPromptInput | null =
		commandAvailability.submitPrompt && preparedDraft.length > 0
			? { modality: "text", text: preparedDraft }
			: null;
	const status = modelPreparing
		? "preparing"
		: modelFailed
			? "failed"
			: responding
				? "responding"
				: "ready";
	const artifacts = snapshot.context.documents.map((document) => ({
		...document,
		displayTitle: readableArtifactTitle(document.title, document.id),
		nodes: document.nodes.map((node) => {
			const payload = node.kind === "action" ? node.payload : null;
			const speech =
				typeof payload === "object" &&
				payload !== null &&
				!Array.isArray(payload) &&
				typeof payload.speech === "string" &&
				payload.speech.trim().length > 0
					? payload.speech.trim()
					: undefined;
			const input =
				node.kind === "action" &&
				node.commandName === "completeResponse" &&
				typeof payload === "object" &&
				payload !== null &&
				!Array.isArray(payload) &&
				typeof payload.text === "string" &&
				payload.text.trim().length > 0 &&
				(payload.speech === undefined || speech !== undefined)
					? {
							text: payload.text.trim(),
							...(speech ? { speech } : {}),
						}
					: null;
			const projection = {
				action: input
					? { enabled: commandAvailability.completeResponse, input }
					: null,
				chart:
					node.kind === "chart"
						? {
								accessibleLabel: `${node.chartType} chart: ${node.series
									.map((series) => `${series.label} ${series.value}`)
									.join(", ")}`,
								maximum: Math.max(
									1,
									...node.series.map((series) => Math.abs(series.value)),
								),
								series: node.series.map((series) => ({
									...series,
									accessibleLabel: `${series.label}: ${series.value}`,
									progressValue: Math.max(0, series.value),
								})),
							}
						: null,
				diffText:
					node.kind === "code-diff"
						? `Before:\n${node.before ?? ""}\nAfter:\n${node.after ?? ""}`
						: null,
				displayRows:
					node.kind === "table"
						? node.rows.map((row) => ({
								id: row.id,
								cells: row.cells.map((cell, index) =>
									tableCellView(cell, node.columns[index]?.label ?? ""),
								),
							}))
						: [],
			};
			if (node.kind !== "checklist") return { ...node, ...projection };
			return {
				...node,
				...projection,
				items: node.items.map((item) => {
					const setCheckedInput: SetChecklistItemInput | null =
						canSetChecklistItem
							? {
									artifactId: document.id,
									expectedRevision: document.revision,
									nodeId: node.id,
									itemId: item.id,
									checked: !item.checked,
								}
							: null;
					return { ...item, setCheckedInput };
				}),
			};
		}),
	}));
	const activeArtifact =
		artifacts.find(
			(artifact) => artifact.id === snapshot.context.activeArtifactId,
		) ??
		artifacts[artifacts.length - 1] ??
		null;
	const artifactSummaries = artifacts.map((artifact) => ({
		id: artifact.id,
		title: artifact.displayTitle,
		revision: artifact.revision,
		nodeCount: artifact.nodes.length,
		active: artifact.id === activeArtifact?.id,
		selectInput: commandAvailability.selectArtifact
			? ({ artifactId: artifact.id } satisfies SelectArtifactInput)
			: null,
	}));
	const activeArtifactRevisions = activeArtifact
		? snapshot.context.artifactRevisions
				.filter((document) => document.id === activeArtifact.id)
				.map((document) => {
					const current = document.revision === activeArtifact.revision;
					const nodeCount = document.nodes.length;
					const restoreInput: RestoreArtifactRevisionInput | null =
						!current && commandAvailability.restoreArtifactRevision
							? {
									artifactId: activeArtifact.id,
									expectedRevision: activeArtifact.revision,
									revision: document.revision,
								}
							: null;
					return {
						key: `${document.id}:${document.revision}`,
						revision: document.revision,
						title: readableArtifactTitle(document.title, document.id),
						nodeCount,
						current,
						label: `Revision ${document.revision}`,
						summary: `${nodeCount} ${nodeCount === 1 ? "node" : "nodes"}`,
						restoreLabel: current
							? `Current revision ${document.revision}`
							: `Restore revision ${document.revision}`,
						restoreInput,
					};
				})
		: [];
	const turnCount = snapshot.context.messages.filter(
		(message) => message.role === "user",
	).length;
	const respondingProgress = describeRespondingProgress(
		snapshot.context.lastFact,
	);
	const voiceLifecycle = snapshot.context.childLifecycles.voiceCapture;
	const voice = voiceLifecycle?.fact ?? ({ type: "voice-idle" } as const);
	const speechLifecycle = snapshot.context.childLifecycles.speechDelivery;
	const speechDelivery = speechLifecycle?.fact ?? null;
	const speechCommit: {
		id: string;
		text: string;
		status: "played" | "muted" | "unavailable";
	} | null = speechLifecycle
		? speechLifecycle.fact?.type === "speech-delivery-completed"
			? {
					id: speechLifecycle.id,
					text: speechLifecycle.text,
					status: "played",
				}
			: speechLifecycle.fact?.type === "speech-delivery-muted"
				? {
						id: speechLifecycle.id,
						text: speechLifecycle.text,
						status: "muted",
					}
				: speechLifecycle.fact?.type === "speech-delivery-unavailable" ||
						speechLifecycle.fact?.type === "speech-delivery-failed"
					? {
							id: speechLifecycle.id,
							text: speechLifecycle.text,
							status: "unavailable",
						}
					: null
		: null;
	const transcript = voice.type === "voice-transcript" ? voice.text : null;
	const transcriptReady = commandAvailability.submitVoiceTranscript;
	const voiceFailure =
		voice.type === "voice-permission-denied" || voice.type === "voice-error"
			? voice
			: null;
	const documentSchema = JSON.stringify(
		activeArtifact
			? {
					id: activeArtifact.id,
					title: activeArtifact.title,
					revision: activeArtifact.revision,
					nodes: activeArtifact.nodes.map((node) => {
						const { action: _action, ...schemaNode } = node;
						if (schemaNode.kind === "checklist") {
							return {
								...schemaNode,
								items: schemaNode.items.map(
									({ setCheckedInput: _setCheckedInput, ...item }) => item,
								),
							};
						}
						if ("displayRows" in schemaNode) {
							const { displayRows: _displayRows, ...actorNode } = schemaNode;
							return actorNode;
						}
						return schemaNode;
					}),
				}
			: { artifacts: [] },
		null,
		2,
	);
	const providerState = modelPreparing
		? "preparing"
		: modelFailed
			? "failed"
			: "available";
	const turnState = modelPreparing
		? "preparing"
		: modelFailed
			? "unavailable"
			: responding
				? "responding"
				: "idle";
	const actorMatchText = modelPreparing
		? 'matches("preparing")'
		: modelFailed
			? 'matches("unavailable")'
			: `matches({\n  available: { turn: "${responding ? "responding" : "idle"}" },\n})`;
	const artifactLine = activeArtifact
		? `${activeArtifact.displayTitle} · revision ${activeArtifact.revision}`
		: "No accepted artifact yet";
	let previewText: string;
	switch (presentation.runtimePreview) {
		case "browser":
			previewText = `Browser JSX preview\n${artifactLine}\n${describeFact(snapshot.context.lastFact)}`;
			break;
		case "terminal":
			previewText = `Terminal projection\nPreview only · no remote terminal sync\nstate: ${turnState}\n${artifactLine}`;
			break;
		case "speech":
			previewText = `Speech projection\n${snapshot.context.response?.speech ?? snapshot.context.response?.text ?? "No response available for speech"}\nstatus: ${snapshot.context.speech?.status ?? "idle"}`;
			break;
		case "headless":
			previewText = `Headless projection\n${JSON.stringify(
				{
					state: snapshot.value,
					actorRevision: snapshot.context.revision,
					activeArtifactId: snapshot.context.activeArtifactId,
				},
				null,
				2,
			)}`;
			break;
	}
	const capabilityRows =
		presentation.capabilityOutcomes.length === 0
			? [
					{
						key: "empty-capability-row",
						className: "capability-outcome capability-outcome-empty",
						heading: "No external capability facts yet",
						statusLabel: "waiting",
						message: "Capability adapter outcomes appear after execution.",
					},
				]
			: presentation.capabilityOutcomes.flatMap((outcome, index) => {
					const key = `${outcome.ownerId}-${outcome.toolName}-${index}`;
					const capabilityRow = {
						key,
						className: "capability-outcome",
						heading: `${outcome.ownerId} · ${outcome.toolName}`,
						statusLabel: `${outcome.type}${outcome.status ? ` · HTTP ${outcome.status}` : ""}${outcome.cacheStatus ? ` · cache ${outcome.cacheStatus}` : ""}`,
						message: [
							outcome.message,
							outcome.retry
								? `${outcome.retry.attempts}/${outcome.retry.maxAttempts} attempts${outcome.retry.exhausted ? " · exhausted" : ""}`
								: null,
							outcome.fallback
								? fallbackAttemptSummary(outcome.fallback)
								: null,
						]
							.filter((value): value is string => value !== null)
							.join(" · "),
					};
					const pricingRows = (outcome.pricingRows ?? []).map(
						(pricing, pricingIndex) => ({
							key: `${key}-pricing-${pricingIndex}`,
							className: "capability-outcome",
							heading: `${pricing.subject} · product pricing`,
							statusLabel: `${pricing.priceStatus} · cache ${pricing.cacheStatus}`,
							message: [
								pricing.product && pricing.size
									? `${pricing.product} · ${pricing.size}`
									: "No selected product",
								pricing.priceStatus === "unverified"
									? PRODUCT_PRICE_REASON_LABELS[pricing.reasonCode]
									: null,
								`native ${pricing.nativeStatus}`,
								`Brave ${pricing.braveStatus}`,
							]
								.filter((value): value is string => value !== null)
								.join(" · "),
							...pricing,
						}),
					);
					return [capabilityRow, ...pricingRows];
				});
	const domainPolicySections = presentation.domainPolicy
		? [
				{
					key: "assumptions",
					heading: "Assumptions",
					rows: presentation.domainPolicy.assumptions.map((assumption) => ({
						key: assumption.id,
						text: assumption.label,
					})),
				},
				{
					key: "questions",
					heading: "Clarification questions",
					rows: presentation.domainPolicy.questions.map((question) => ({
						key: question.id,
						text: question.prompt,
					})),
				},
				{
					key: "evidence",
					heading: "Evidence requirements",
					rows: presentation.domainPolicy.evidenceRequirements.map(
						(requirement) => ({
							key: requirement.id,
							text: requirement.label,
						}),
					),
				},
			].filter((section) => section.rows.length > 0)
		: [];
	const domainPolicy = presentation.domainPolicy
		? {
				heading: "Domain policy proof",
				statusLabel: presentation.domainPolicy.outcome.replace("-", " "),
				summary: presentation.domainPolicy.summary,
				identityRows: [
					{
						key: "domain",
						label: "Domain",
						value: presentation.domainPolicy.domainLabel,
					},
					{
						key: "policy",
						label: "Policy",
						value: presentation.domainPolicy.policyLabel,
					},
				],
				sections: domainPolicySections,
			}
		: null;
	const manifestRows =
		presentation.runtimeManifest.length === 0
			? [
					{
						key: "empty-manifest-row",
						name: "Awaiting the next model request",
						dataCommandName: "pending-model-request",
						summaryLabel: "no live commands captured",
						descriptions: [
							"The exact availability-scoped manifest appears at the next model boundary.",
						],
						schemaText: "input · unavailable until request",
					},
				]
			: presentation.runtimeManifest.map((tool) => ({
					key: tool.name,
					name: tool.name,
					dataCommandName: tool.name,
					summaryLabel: `${tool.ownerId} · live · ${tool.gated ? "gated" : "available"}`,
					descriptions: tool.description ? [tool.description] : [],
					schemaText: formatSchema(tool.inputSchema),
				}));
	const blueprintRows = Object.entries(blueprintCommands).map(
		([name, commandSchema]) => ({
			key: name,
			className: "command",
			name,
			descriptions:
				typeof commandSchema.description === "string"
					? [commandSchema.description]
					: [],
			schemaText: formatSchema(commandSchema.input),
		}),
	);
	const traceRows = [
		{
			key: "transcript",
			className: "trace-step",
			heading: "Text or speech transcript",
			detail: "outer adapter → text + modality",
		},
		{
			key: "actor-fact",
			className: "trace-step",
			heading: describeFact(snapshot.context.lastFact),
			detail: "current public actor fact",
		},
		{
			key: "artifact",
			className: "trace-step",
			heading: activeArtifact
				? `Artifact revision ${activeArtifact.revision} stored`
				: "Awaiting accepted artifact",
			detail: "semantic nodes, never generated DOM",
		},
		...(presentation.turn?.capability
			? [
					{
						key: "capability",
						className: "trace-step capability-proof",
						heading: `${presentation.turn.capability.provider} · ${presentation.turn.capability.tool}`,
						detail: capabilityProofSummary(presentation.turn.capability),
					},
				]
			: []),
		...(presentation.turn?.collision
			? [
					{
						key: "collision",
						className: "trace-step collision-proof",
						heading: "Capability manifest collision",
						detail: `${presentation.turn.collision.toolNames.join(", ")} · ${presentation.turn.collision.owners.join(" + ")}`,
					},
				]
			: []),
	];
	const resultQuality = productPricingResultQuality(
		presentation.domainPolicy,
		presentation.capabilityOutcomes,
	);
	return {
		sessionId: snapshot.context.sessionId,
		lifecycle: {
			state: snapshot.value,
			activeTurnId: snapshot.context.activeTurnId,
			lastTurnTerminal: snapshot.context.lastTurnTerminal,
			children: snapshot.context.childLifecycles,
		},
		portRequests: snapshot.context.portRequests,
		modelContext: {
			status,
			activeArtifactId: snapshot.context.activeArtifactId,
			artifacts: snapshot.context.documents,
		},
		status,
		commandAvailability,
		intents: {
			submitPrompt: submitPromptInput,
		},
		commandCount: blueprintRows.length,
		statusLabel: modelPreparing
			? "Preparing local model"
			: modelFailed
				? "Model unavailable"
				: responding
					? "Responding"
					: "Ready",
		canSubmitPrompt: commandAvailability.submitPrompt,
		canSetChecklistItem,
		canRestoreArtifactRevision: commandAvailability.restoreArtifactRevision,
		canRetryModel: modelFailed,
		activeArtifact,
		resultQuality,
		artifactSummaries,
		activeArtifactRevisions,
		turnCount,
		turnLabel: `${turnCount} ${turnCount === 1 ? "turn" : "turns"}`,
		speechStatus: snapshot.context.speech?.status ?? "idle",
		documentSchema,
		voiceState: voiceState(voice),
		transcript,
		transcriptReady,
		microphoneUnavailable: !commandAvailability.startVoiceCapture,
		voiceFailure,
		turnMessage: describeTurn(presentation.turn),
		lastFactLabel: describeFact(snapshot.context.lastFact),
		respondingProgress,
		modelPreparing,
		modelFailed,
		promptPlaceholder: modelPreparing
			? "Waiting for the local model to finish preparing…"
			: modelFailed
				? "Retry the local model before sending a prompt…"
				: "Ask the agent to create or revise an artifact…",
		turnState,
		model: {
			status: modelPreparing
				? "preparing"
				: modelFailed
					? "failed"
					: "available",
			failure: snapshot.context.modelFailure,
		},
		revision: snapshot.context.revision,
		messageCount: snapshot.context.messages.length,
		messages: snapshot.context.messages,
		lastFact: snapshot.context.lastFact,
		artifacts,
		speech: snapshot.context.speech,
		activeArtifactId: snapshot.context.activeArtifactId,
		response: snapshot.context.response,
		canRevise: commandAvailability.reviseArtifact,
		presentation: {
			...presentation,
			voice,
			speechDelivery,
			speechCommit,
		},
		runtimeInspector: {
			activeStates: snapshot.value,
			mlx: {
				status: providerState,
				ready: modelAvailable,
				heading: "MLX model readiness",
				statusLabel: providerState,
				detail: modelAvailable
					? "Inference admitted for prompts"
					: "Prompts remain gated",
			},
			actor: {
				lastFact: snapshot.context.lastFact,
				revision: snapshot.context.revision,
				heading: "Compound actor state",
				matchText: actorMatchText,
				factLabel: `Current actor fact · ${describeFact(snapshot.context.lastFact)}`,
			},
			selectedPreview: presentation.runtimePreview,
			preview: {
				text: previewText,
				selectors: runtimePreviewDefinitions.map((preview) => ({
					...preview,
					selected: preview.id === presentation.runtimePreview,
				})),
			},
			capabilityRows,
			domainPolicy,
			domainPolicyCards: domainPolicy ? [domainPolicy] : [],
			trace: {
				acceptedArtifactLabel: activeArtifact
					? `Artifact revision ${activeArtifact.revision} stored`
					: "Awaiting accepted artifact",
				rows: traceRows,
			},
			receipts: [
				{
					id: "browser" as const,
					className: "commit commit-browser",
					icon: "▤",
					title: "Browser · native JSX",
					detail: presentation.documentCommit
						? `${presentation.documentCommit.id} · revision ${presentation.documentCommit.revision}`
						: "awaiting artifact",
					statusLabel: presentation.documentCommit ? "current" : "idle",
				},
				{
					id: "terminal" as const,
					className: "commit commit-terminal",
					icon: ">_",
					title: "Terminal · Node",
					detail: "preview only · no remote terminal sync",
					statusLabel: "headless",
				},
				{
					id: "speech" as const,
					className: "commit commit-speech",
					icon: "◖",
					title: "Speech · audio",
					detail: speechCommit?.text ?? "browser adapter · actor acknowledged",
					statusLabel: speechCommit?.status ?? "idle",
				},
			],
			schemaExplorer: {
				manifest: {
					heading: "Availability-scoped model manifest",
					countLabel: `${presentation.runtimeManifest.length} live ${presentation.runtimeManifest.length === 1 ? "command" : "commands"}`,
					rows: manifestRows,
				},
				blueprint: {
					heading: "All-component blueprint",
					countLabel: `${blueprintRows.length} commands from getSchema()`,
					rows: blueprintRows,
				},
				policy: {
					heading: "renderJavascript rejected",
					result: blueprintRows.some((row) => row.name === "renderJavascript")
						? "unexpectedly admitted"
						: "command-not-allowed · absent from schema",
				},
			},
		},
	};
};
