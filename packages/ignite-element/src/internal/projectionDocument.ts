import { validateToolInputValue } from "../tools/core";
import type {
	IgniteProjectionInspection,
	ProjectionActionNode,
	ProjectionChartNode,
	ProjectionChecklistNode,
	ProjectionCodeDiffNode,
	ProjectionDecisionLogNode,
	ProjectionDocument,
	ProjectionDocumentNode,
	ProjectionDocumentPatch,
	ProjectionFormNode,
	ProjectionSpeechRequest,
	ProjectionTableNode,
	ProjectionTextNode,
	ProjectionTimelineNode,
} from "../types/agent";
import type { IgniteAgentSchema, IgniteSchemaValue } from "../types/schema";

type ValidationContext = {
	schema: IgniteAgentSchema<IgniteSchemaValue, IgniteSchemaValue>;
	canExecute(commandName: string): boolean;
};

const forbiddenKeys = new Set([
	"dom",
	"domRef",
	"handler",
	"handlers",
	"html",
	"import",
	"imports",
	"javascript",
	"jsx",
	"module",
	"modules",
	"onClick",
	"onInput",
	"script",
	"selector",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.length > 0;
}

function collectForbiddenKeys(
	value: unknown,
	path: string,
	issues: string[],
): void {
	if (Array.isArray(value)) {
		value.forEach((entry, index) => {
			collectForbiddenKeys(entry, `${path}[${index}]`, issues);
		});
		return;
	}

	if (!isRecord(value)) {
		return;
	}

	for (const [key, entry] of Object.entries(value)) {
		if (forbiddenKeys.has(key)) {
			issues.push(`${path}.${key}: executable content is not allowed`);
		}
		collectForbiddenKeys(entry, `${path}.${key}`, issues);
	}
}

function validateActionNode(
	node: ProjectionActionNode,
	context: ValidationContext,
	path: string,
): string[] {
	const issues: string[] = [];
	const command = context.schema.commands[node.commandName];
	if (!command) {
		issues.push(`${path}.commandName: unknown command "${node.commandName}"`);
		return issues;
	}

	const input = command.input;
	if (isRecord(input)) {
		for (const issue of validateToolInputValue(
			input,
			node.payload,
			`${path}.payload`,
		)) {
			issues.push(issue);
		}
	}

	if (command.gated === true && !context.canExecute(node.commandName)) {
		issues.push(
			`${path}.commandName: command "${node.commandName}" is unavailable`,
		);
	}

	return issues;
}

function validateTextNode(node: ProjectionTextNode, path: string): string[] {
	return isNonEmptyString(node.text) ? [] : [`${path}.text: required`];
}

function validateChecklistNode(
	node: ProjectionChecklistNode,
	path: string,
): string[] {
	const issues: string[] = [];
	if (node.items.length === 0) {
		issues.push(`${path}.items: must include at least one item`);
	}
	for (const [index, item] of node.items.entries()) {
		if (!isNonEmptyString(item.id)) {
			issues.push(`${path}.items[${index}].id: required`);
		}
		if (!isNonEmptyString(item.label)) {
			issues.push(`${path}.items[${index}].label: required`);
		}
	}
	return issues;
}

function validateFormNode(node: ProjectionFormNode, path: string): string[] {
	const issues: string[] = [];
	if (node.fields.length === 0) {
		issues.push(`${path}.fields: must include at least one field`);
	}
	for (const [index, field] of node.fields.entries()) {
		if (!isNonEmptyString(field.id)) {
			issues.push(`${path}.fields[${index}].id: required`);
		}
		if (!isNonEmptyString(field.label)) {
			issues.push(`${path}.fields[${index}].label: required`);
		}
		if (!isRecord(field.input) || !isNonEmptyString(field.input.type)) {
			issues.push(`${path}.fields[${index}].input.type: required`);
		}
	}
	return issues;
}

function validateTableNode(node: ProjectionTableNode, path: string): string[] {
	const issues: string[] = [];
	if (node.columns.length === 0) {
		issues.push(`${path}.columns: must include at least one column`);
	}
	for (const [index, column] of node.columns.entries()) {
		if (!isNonEmptyString(column.id)) {
			issues.push(`${path}.columns[${index}].id: required`);
		}
		if (!isNonEmptyString(column.label)) {
			issues.push(`${path}.columns[${index}].label: required`);
		}
	}
	return issues;
}

function validateTimelineNode(
	node: ProjectionTimelineNode,
	path: string,
): string[] {
	const issues: string[] = [];
	for (const [index, entry] of node.events.entries()) {
		if (!isNonEmptyString(entry.id)) {
			issues.push(`${path}.events[${index}].id: required`);
		}
		if (!isNonEmptyString(entry.label)) {
			issues.push(`${path}.events[${index}].label: required`);
		}
		if (!isNonEmptyString(entry.timestamp)) {
			issues.push(`${path}.events[${index}].timestamp: required`);
		}
	}
	return issues;
}

function validateChartNode(node: ProjectionChartNode, path: string): string[] {
	const issues: string[] = [];
	if (node.series.length === 0) {
		issues.push(`${path}.series: must include at least one series item`);
	}
	for (const [index, entry] of node.series.entries()) {
		if (!isNonEmptyString(entry.id)) {
			issues.push(`${path}.series[${index}].id: required`);
		}
		if (!isNonEmptyString(entry.label)) {
			issues.push(`${path}.series[${index}].label: required`);
		}
	}
	return issues;
}

function validateCodeDiffNode(
	node: ProjectionCodeDiffNode,
	path: string,
): string[] {
	const issues: string[] = [];
	if (!isNonEmptyString(node.before) && !isNonEmptyString(node.after)) {
		issues.push(`${path}: code diff requires before or after content`);
	}
	return issues;
}

function validateDecisionLogNode(
	node: ProjectionDecisionLogNode,
	path: string,
): string[] {
	const issues: string[] = [];
	if (node.entries.length === 0) {
		issues.push(`${path}.entries: must include at least one entry`);
	}
	for (const [index, entry] of node.entries.entries()) {
		if (!isNonEmptyString(entry.id)) {
			issues.push(`${path}.entries[${index}].id: required`);
		}
		if (!isNonEmptyString(entry.title)) {
			issues.push(`${path}.entries[${index}].title: required`);
		}
		if (!isNonEmptyString(entry.decision)) {
			issues.push(`${path}.entries[${index}].decision: required`);
		}
	}
	return issues;
}

function validateNode(
	node: ProjectionDocumentNode,
	context: ValidationContext,
	path: string,
): string[] {
	const issues: string[] = [];
	if (!isNonEmptyString(node.id)) {
		issues.push(`${path}.id: required`);
	}
	collectForbiddenKeys(node, path, issues);

	switch (node.kind) {
		case "text":
			return [...issues, ...validateTextNode(node, path)];
		case "checklist":
			return [...issues, ...validateChecklistNode(node, path)];
		case "action":
			return [...issues, ...validateActionNode(node, context, path)];
		case "form":
			return [
				...issues,
				...validateFormNode(node, path),
				...(node.submit
					? validateActionNode(node.submit, context, `${path}.submit`)
					: []),
			];
		case "table":
			return [...issues, ...validateTableNode(node, path)];
		case "timeline":
			return [...issues, ...validateTimelineNode(node, path)];
		case "chart":
			return [...issues, ...validateChartNode(node, path)];
		case "code-diff":
			return [...issues, ...validateCodeDiffNode(node, path)];
		case "decision-log":
			return [...issues, ...validateDecisionLogNode(node, path)];
	}
}

export function validateProjectionDocument(
	document: ProjectionDocument,
	context: ValidationContext,
): string[] {
	const issues: string[] = [];
	if (!isNonEmptyString(document.id)) {
		issues.push("id: required");
	}
	if (!isNonEmptyString(document.revision)) {
		issues.push("revision: required");
	}
	if (document.nodes.length === 0) {
		issues.push("nodes: must include at least one node");
	}

	const seenNodeIds = new Set<string>();
	for (const [index, node] of document.nodes.entries()) {
		for (const issue of validateNode(node, context, `nodes[${index}]`)) {
			issues.push(issue);
		}
		if (seenNodeIds.has(node.id)) {
			issues.push(`nodes[${index}].id: duplicate node id "${node.id}"`);
		}
		seenNodeIds.add(node.id);
	}

	return issues;
}

export function upsertProjectionDocument(
	documents: readonly ProjectionDocument[],
	document: ProjectionDocument,
): ProjectionDocument[] {
	const nextDocuments = documents.filter((entry) => entry.id !== document.id);
	return [...nextDocuments, document];
}

export function applyProjectionDocumentPatch(
	document: ProjectionDocument,
	patch: ProjectionDocumentPatch,
): ProjectionDocument {
	if (document.id !== patch.documentId) {
		throw new Error(
			`Projection patch target "${patch.documentId}" does not match document "${document.id}".`,
		);
	}
	if (document.revision === patch.revision) {
		throw new Error(
			`Projection patch revision "${patch.revision}" must advance beyond the current document revision.`,
		);
	}

	switch (patch.type) {
		case "set-node": {
			const nextNodes = document.nodes.filter(
				(node) => node.id !== patch.node.id,
			);
			nextNodes.push(patch.node);
			return {
				...document,
				revision: patch.revision,
				nodes: nextNodes,
			};
		}
		case "remove-node":
			return {
				...document,
				revision: patch.revision,
				nodes: document.nodes.filter((node) => node.id !== patch.nodeId),
			};
	}
}

export function isPendingSpeechRequest(
	speech: ProjectionSpeechRequest | null | undefined,
): speech is ProjectionSpeechRequest {
	return speech?.status === "pending";
}

export function validateProjectionSelection<
	Snapshot,
	SchemaState = IgniteSchemaValue,
	View extends Record<string, unknown> = Record<never, never>,
>(
	document: ProjectionDocument,
	inspection: IgniteProjectionInspection<Snapshot, SchemaState, View>,
): string[] {
	return validateProjectionDocument(document, {
		schema: inspection.schema as IgniteAgentSchema<
			IgniteSchemaValue,
			IgniteSchemaValue
		>,
		canExecute: inspection.canExecute,
	});
}
