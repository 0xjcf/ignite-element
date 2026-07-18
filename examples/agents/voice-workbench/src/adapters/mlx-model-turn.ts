import { igniteTools, isOk } from "ignite-element/tools";
import {
	type ModelToolFeedback,
	modelTools,
	normalizeModelIssues,
} from "../agent-loop";
import {
	type CapabilityExecutionFact,
	type CapabilityFallbackAttempt,
	type CapabilityFederation,
	type CapabilityOwner,
	type CapabilityRetryFact,
	createCapabilityFederation,
	runCapability,
} from "../capability-federation";
import { PRODUCT_PRICE_REASON_CODES } from "../domains/product-pricing/price-capability";
import type { DomainRegistry } from "../domains/registry";
import {
	type MlxWorkbenchConfiguration,
	requestMlxWorkbenchModel,
} from "../model";
import type { ModelTurnPortRequest } from "../model-turn";
import type {
	ModelTurnPort,
	ModelTurnPortFact,
	ModelTurnPortLifecycle,
	ModelTurnPortResult,
} from "../ports";
import type {
	WorkbenchCapabilityProof,
	WorkbenchCollisionProof,
	WorkbenchPricingProofRow,
} from "../session";
import type { VoiceWorkbenchComponent } from "../workbench-component";
import {
	auditCompletionEvidence,
	normalizeSemanticArtifactIdentity,
} from "../workbench-policy";

const EXTERNAL_EVIDENCE_TOOL_NAMES = new Set(["searchWeb", "priceProducts"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

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
	workbench: VoiceWorkbenchComponent,
): ModelToolFeedback => {
	if (execution.type === "success") {
		if (execution.ownerId === "workbench-component") {
			const data = isRecord(execution.data) ? execution.data : {};
			return {
				id,
				command: execution.toolName,
				ownerId: execution.ownerId,
				status: "accepted",
				view: data.view ?? workbench.getView().modelContext,
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
			view: workbench.getView().modelContext,
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
			view: workbench.getView().modelContext,
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
		view: workbench.getView().modelContext,
		events: [],
	};
};

const cancelledComponentExecution = (
	toolName: string,
): CapabilityExecutionFact => ({
	type: "timeout",
	ownerId: "workbench-component",
	toolName,
	message: "The component command was cancelled.",
});

type ModelTurnAdapterState = {
	owner: symbol;
	routing: CapabilityFederation | null;
};

/**
 * MLX and capability adapter for the parent-supervised model-turn child.
 * It executes one projected request at a time and returns correlated facts;
 * actor creation, lifecycle, timeout, and disposal stay in the parent/runtime.
 */
export const createWorkbenchModelTurnPort = (
	configuration: MlxWorkbenchConfiguration,
	externalCapabilities: readonly CapabilityOwner[],
	domains: DomainRegistry,
	workbench: VoiceWorkbenchComponent,
): ModelTurnPort & ModelTurnPortLifecycle => {
	const turns = new Map<string, ModelTurnAdapterState>();
	const startTurn = (turnId: string) => {
		const owner = Symbol(turnId);
		turns.set(turnId, { owner, routing: null });
		let released = false;
		return {
			dispose() {
				if (released) return;
				released = true;
				if (turns.get(turnId)?.owner === owner) turns.delete(turnId);
			},
		};
	};

	const componentCapability = (
		request: ModelTurnPortRequest,
		signal: AbortSignal,
	): CapabilityOwner => {
		const tools = igniteTools(workbench);
		return {
			id: "workbench-component",
			manifest: modelTools(tools.manifest),
			run: async (call, callSignal): Promise<CapabilityExecutionFact> => {
				if (signal.aborted || callSignal?.aborted) {
					return cancelledComponentExecution(call.name);
				}
				const history = "history" in request ? request.history : [];
				const prompt =
					"prompt" in request
						? request.prompt
						: { channel: "text" as const, text: "" };
				if (call.name === "completeResponse") {
					const view = workbench.getView().modelContext;
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
				const materializedCall = domains.materializeArtifact({
					prompt,
					history,
					view: workbench.getView().modelContext,
					call,
				});
				if (signal.aborted || callSignal?.aborted) {
					return cancelledComponentExecution(call.name);
				}
				const execution = await tools.run({
					...materializedCall,
					input: normalizeSemanticArtifactIdentity(
						materializedCall.name,
						materializedCall.input,
					),
				});
				if (signal.aborted || callSignal?.aborted) {
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
				const rejected = execution.value.events.find(
					(actorEvent) => actorEvent.type === "artifact-rejected",
				);
				if (rejected) {
					return {
						type: "validation",
						ownerId: "workbench-component",
						toolName: call.name,
						message: "The actor rejected the proposed command.",
						reason:
							"reason" in rejected ? String(rejected.reason) : "actor-rejected",
						...("issues" in rejected && rejected.issues
							? { issues: normalizeModelIssues(rejected.issues) }
							: {}),
						actorRejected: true,
					};
				}
				return {
					type: "success",
					ownerId: "workbench-component",
					toolName: call.name,
					data: {
						view: workbench.getView().modelContext,
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

	const executionResult = (
		execution: CapabilityExecutionFact,
		request: ModelTurnPortRequest,
	): { feedback: ModelToolFeedback; facts: ModelTurnPortFact[] } => {
		const facts: ModelTurnPortFact[] = [];
		const correlation = {
			turnId: request.turnId,
			attemptId: request.attemptId,
		};
		const proof = capabilityProof(execution);
		const domainDecision = domains.projectExecution(execution);
		if (domainDecision) {
			facts.push({
				type: "DOMAIN_POLICY_RECORDED",
				decision: domainDecision,
				...correlation,
			});
		}
		if (execution.ownerId !== "workbench-component") {
			facts.push({
				type: "CAPABILITY_OUTCOME_RECORDED",
				outcome: {
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
					...(proof ? { proof } : {}),
				},
				...correlation,
			});
		}
		return {
			feedback: {
				...capabilityFeedback(execution, execution.toolName, workbench),
				attemptId: request.attemptId,
			},
			facts,
		};
	};

	const port: ModelTurnPort = async (
		request,
		{ signal },
	): Promise<ModelTurnPortResult> => {
		const correlation = {
			turnId: request.turnId,
			attemptId: request.attemptId,
		};
		if (signal.aborted) {
			return {
				receipt: {
					type: "PORT_FAILED",
					...correlation,
					failure: {
						kind: "timeout",
						message: "The model turn was cancelled.",
					},
				},
			};
		}
		switch (request.type) {
			case "request-model": {
				const state = turns.get(request.turnId);
				if (!state) {
					return {
						receipt: {
							type: "PORT_FAILED",
							...correlation,
							failure: {
								kind: "configuration",
								message: "Model-turn routing ownership was unavailable.",
							},
						},
					};
				}
				const federation = createCapabilityFederation([
					componentCapability(request, signal),
					...domains.capabilities,
					...externalCapabilities,
				]);
				if (!federation.ok) {
					const collision = collisionProof(
						federation.error.toolNames,
						federation.error.owners,
					);
					const message = `Capability configuration rejected duplicate tool names: ${collision.toolNames.join(", ") || "unknown tools"}.`;
					return {
						receipt: {
							type: "PORT_FAILED",
							...correlation,
							failure: {
								kind: "configuration",
								message,
							},
						},
						facts: [
							{
								type: "TURN_RECORDED",
								fact: {
									type: "model-failed",
									failureKind: "configuration",
									message,
									trace: [],
									collision,
								},
								...correlation,
							},
						],
					};
				}
				state.routing = federation;
				const manifest = domains.manifestForExecution({
					prompt: request.prompt,
					history: request.history,
					manifest: federation.manifest,
				});
				const facts: ModelTurnPortFact[] = [
					{
						type: "RUNTIME_MANIFEST_RECORDED",
						manifest: manifest.map((tool) => ({
							...tool,
							ownerId:
								federation.ownerByTool.get(tool.name)?.id ?? "federation",
						})),
						...correlation,
					},
				];
				const applicableDomainEvidenceAvailable = domains.packs.some(
					(pack) =>
						pack.appliesTo(request.prompt.text) &&
						pack.capabilities.some((capability) =>
							capability.manifest.some((tool) =>
								EXTERNAL_EVIDENCE_TOOL_NAMES.has(tool.name),
							),
						),
				);
				const result = await requestMlxWorkbenchModel(
					configuration,
					{
						prompt: request.prompt,
						tools: manifest,
						view: workbench.getView().modelContext,
						history: request.history,
						domainPolicyInstructions: domains.modelInstructions,
						capabilities: {
							internetAccess:
								manifest.some((tool) =>
									EXTERNAL_EVIDENCE_TOOL_NAMES.has(tool.name),
								) || applicableDomainEvidenceAvailable
									? "available"
									: "unavailable",
						},
					},
					signal,
				);
				return {
					receipt: { type: "MODEL_RESOLVED", ...correlation, result },
					facts,
				};
			}
			case "authorize-call": {
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
					return {
						receipt: {
							type: "AUTHORIZATION_RESOLVED",
							...correlation,
							allowed: true,
						},
					};
				}
				const result = executionResult(execution, request);
				return {
					receipt: {
						type: "AUTHORIZATION_RESOLVED",
						...correlation,
						allowed: false,
						feedback: result.feedback,
					},
					facts: result.facts,
				};
			}
			case "execute-call": {
				const routing = turns.get(request.turnId)?.routing;
				if (!routing) {
					return {
						receipt: {
							type: "PORT_FAILED",
							...correlation,
							failure: {
								kind: "configuration",
								message: "Capability routing was unavailable for this turn.",
							},
						},
					};
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
				const result = executionResult(execution, request);
				return {
					receipt: {
						type: "CAPABILITY_RESOLVED",
						...correlation,
						feedback: result.feedback,
					},
					facts: result.facts,
				};
			}
		}
	};
	return Object.assign(port, {
		startTurn,
		dispose: () => turns.clear(),
	});
};
