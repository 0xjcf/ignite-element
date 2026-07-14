import { igniteTools, isOk } from "ignite-element/tools";
import {
	type ModelExchange,
	type ModelResult,
	type ModelToolFeedback,
	type ModelTurnResult,
	modelTools,
	modelTurn,
} from "./agent-loop";
import {
	type CapabilityExecutionFact,
	type CapabilityFederation,
	type CapabilityOwner,
	createCapabilityFederation,
	runCapability,
} from "./capability-federation";
import {
	type MlxWorkbenchConfiguration,
	requestMlxWorkbenchModel,
} from "./model";
import {
	component,
	type WorkbenchCapabilityProof,
	type WorkbenchCollisionProof,
	type WorkbenchTurnFact,
} from "./session";

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

const boundedText = (value: string, maximum = 160): string =>
	value.trim().slice(0, maximum);

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

const capabilityProof = (
	execution: CapabilityExecutionFact,
): WorkbenchCapabilityProof | null => {
	if (execution.ownerId === "workbench-component") return null;
	const provider =
		execution.type === "success"
			? execution.receipt.provider
			: execution.ownerId;
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
				}
			: boundedStatus(execution.status) === undefined
				? {}
				: { status: boundedStatus(execution.status) }),
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
			...(execution.issues ? { issues: execution.issues } : {}),
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
		?.slice(0, 8)
		.map((issue) => boundedText(issue, 160));
	const providerStatus = boundedStatus(execution.status);
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
		},
		view: component.getView().modelContext,
		events: [],
	};
};

export async function completeSubmittedPrompt(
	configuration: MlxWorkbenchConfiguration,
	event: { modality: "text" | "speech"; text: string },
	externalCapabilities: readonly CapabilityOwner[] = [],
): Promise<ModelTurnResult | null> {
	const prompt = { channel: event.modality, text: event.text };
	const history: ModelExchange[] = [];
	let result: ModelTurnResult | null = null;
	let priorTrace: ModelTurnResult["trace"] = [];
	let currentCapability: WorkbenchCapabilityProof | undefined;
	let currentCollision: WorkbenchCollisionProof | undefined;

	for (let round = 0; round < 5; round += 1) {
		const tools = igniteTools(component);
		const componentOwner: CapabilityOwner = {
			id: "workbench-component",
			manifest: modelTools(tools.manifest),
			run: async (call): Promise<CapabilityExecutionFact> => {
				const execution = await tools.run(call);
				if (!isOk(execution)) {
					switch (execution.error.kind) {
						case "InvalidInput":
							return {
								type: "validation",
								ownerId: "workbench-component",
								toolName: call.name,
								message: "The component command input is invalid.",
								reason: execution.error.kind,
								issues: execution.error.issues,
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
							? { issues: rejectedByActor.issues }
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
		const federation = createCapabilityFederation([
			componentOwner,
			...externalCapabilities,
		]);
		if (!federation.ok) {
			currentCollision = collisionProof(
				federation.error.toolNames,
				federation.error.owners,
			);
			const names = currentCollision.toolNames.join(", ") || "unknown tools";
			result = {
				accepted: false,
				reason: "model-failed",
				failure: {
					kind: "configuration",
					message: `Capability configuration rejected duplicate tool names: ${names}.`,
				},
				trace: priorTrace,
			};
			break;
		}
		const routing: CapabilityFederation = federation;
		const response: ModelResult = await requestMlxWorkbenchModel(
			configuration,
			{
				prompt,
				tools: federation.manifest,
				view: component.getView().modelContext,
				history,
				capabilities: {
					internetAccess: federation.manifest.some(
						(tool) => tool.name === "searchWeb",
					)
						? "available"
						: "unavailable",
				},
			},
		);
		const protocol = modelTurn(response);
		let step = protocol.next();
		while (!step.done) {
			const call = step.value;
			const execution = await runCapability(routing, {
				id: call.id,
				name: call.command,
				input: call.input,
			});
			const proof = capabilityProof(execution);
			if (proof) currentCapability = proof;
			step = protocol.next(
				capabilityFeedback(execution, call.id ?? `model-round-${round}`),
			);
		}
		result = {
			...step.value,
			trace: [...priorTrace, ...step.value.trace],
		};
		if ("exchange" in step.value) history.push(step.value.exchange);
		priorTrace = result.trace;
		if (result.accepted || result.reason === "model-failed") break;
	}

	if (!result) return null;
	await component.execute({
		command: "recordTurn",
		input: toTurnFact(result, {
			...(currentCapability ? { capability: currentCapability } : {}),
			...(currentCollision ? { collision: currentCollision } : {}),
		}),
	});
	if (result.accepted && event.modality === "text") {
		await component.execute({ command: "changeDraft", input: "" });
	}
	return result;
}
