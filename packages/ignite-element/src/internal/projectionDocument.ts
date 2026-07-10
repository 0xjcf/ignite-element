import { validateToolInputValue } from "../tools/core";
import type {
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
import type {
	IgniteAgentSchema,
	IgniteSchemaObject,
	IgniteSchemaValue,
} from "../types/schema";

type ValidationContext = {
	schema: IgniteAgentSchema<IgniteSchemaValue, IgniteSchemaValue>;
	canExecute(commandName: string): boolean;
};

type ProjectionDocumentParseResult =
	| { ok: true; document: ProjectionDocument }
	| { ok: false; issues: string[] };

type ProjectionSpeechParseResult =
	| { ok: true; speech: ProjectionSpeechRequest }
	| { ok: false; issues: string[] };

const forbiddenKeys = new Set([
	"dom",
	"domref",
	"handler",
	"handlers",
	"html",
	"import",
	"imports",
	"javascript",
	"jsx",
	"module",
	"modules",
	"onclick",
	"oninput",
	"script",
	"selector",
]);
const eventHandlerKeyPattern = /^on[a-z]/;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.length > 0;
}

function readString(
	value: unknown,
	path: string,
	issues: string[],
): string | null {
	if (!isNonEmptyString(value)) {
		issues.push(`${path}: required`);
		return null;
	}
	return value;
}

function readOptionalString(
	value: unknown,
	path: string,
	issues: string[],
): string | undefined {
	if (typeof value === "undefined") {
		return undefined;
	}
	if (!isNonEmptyString(value)) {
		issues.push(`${path}: required`);
		return undefined;
	}
	return value;
}

function readBoolean(
	value: unknown,
	path: string,
	issues: string[],
): boolean | null {
	if (typeof value !== "boolean") {
		issues.push(`${path}: expected boolean`);
		return null;
	}
	return value;
}

function readNodeBase(
	value: Record<string, unknown>,
	path: string,
	issues: string[],
): { id: string; kind: string } | null {
	const id = readString(value.id, `${path}.id`, issues);
	const kind = readString(value.kind, `${path}.kind`, issues);
	return id && kind ? { id, kind } : null;
}

function isIgniteSchemaValue(value: unknown): value is IgniteSchemaValue {
	if (
		value === null ||
		typeof value === "boolean" ||
		typeof value === "number" ||
		typeof value === "string"
	) {
		return true;
	}
	if (Array.isArray(value)) {
		return value.every((entry) => isIgniteSchemaValue(entry));
	}
	if (!isRecord(value)) {
		return false;
	}
	return Object.values(value).every((entry) => isIgniteSchemaValue(entry));
}

function isIgniteSchemaObject(value: unknown): value is IgniteSchemaObject {
	return isRecord(value) && isIgniteSchemaValue(value);
}

function readSchemaValue(
	value: unknown,
	path: string,
	issues: string[],
): IgniteSchemaValue | undefined {
	if (typeof value === "undefined") {
		return undefined;
	}
	if (!isIgniteSchemaValue(value)) {
		issues.push(`${path}: expected schema value`);
		return undefined;
	}
	return value;
}

function readSchemaObject(
	value: unknown,
	path: string,
	issues: string[],
): IgniteSchemaObject | null {
	if (!isIgniteSchemaObject(value)) {
		issues.push(`${path}: expected object`);
		return null;
	}
	return value;
}

function readNumber(
	value: unknown,
	path: string,
	issues: string[],
): number | null {
	if (typeof value !== "number") {
		issues.push(`${path}: expected number`);
		return null;
	}
	return value;
}

function readChecklistItems(
	value: unknown,
	path: string,
	issues: string[],
): ProjectionChecklistNode["items"] | null {
	if (!Array.isArray(value)) {
		issues.push(`${path}: expected array`);
		return null;
	}
	const items: ProjectionChecklistNode["items"][number][] = [];
	for (const [index, item] of value.entries()) {
		if (!isRecord(item)) {
			issues.push(`${path}[${index}]: expected object`);
			continue;
		}
		const id = readString(item.id, `${path}[${index}].id`, issues);
		const label = readString(item.label, `${path}[${index}].label`, issues);
		const checked = readBoolean(
			item.checked,
			`${path}[${index}].checked`,
			issues,
		);
		if (id && label && checked !== null) {
			items.push({
				...item,
				id,
				label,
				checked,
			});
		}
	}
	return items;
}

function readActionNode(
	value: Record<string, unknown>,
	path: string,
	issues: string[],
): ProjectionActionNode | null {
	const base = readNodeBase(value, path, issues);
	const label = readString(value.label, `${path}.label`, issues);
	const commandName = readString(
		value.commandName,
		`${path}.commandName`,
		issues,
	);
	const description = readOptionalString(
		value.description,
		`${path}.description`,
		issues,
	);
	const payload = readSchemaValue(value.payload, `${path}.payload`, issues);
	if (!base || base.kind !== "action" || !label || !commandName) {
		return null;
	}
	return {
		...value,
		kind: "action",
		id: base.id,
		label,
		commandName,
		...(typeof payload === "undefined" ? {} : { payload }),
		...(description ? { description } : {}),
	};
}

function readFormFields(
	value: unknown,
	path: string,
	issues: string[],
): ProjectionFormNode["fields"] | null {
	if (!Array.isArray(value)) {
		issues.push(`${path}: expected array`);
		return null;
	}
	const fields: ProjectionFormNode["fields"][number][] = [];
	for (const [index, field] of value.entries()) {
		if (!isRecord(field)) {
			issues.push(`${path}[${index}]: expected object`);
			continue;
		}
		const id = readString(field.id, `${path}[${index}].id`, issues);
		const label = readString(field.label, `${path}[${index}].label`, issues);
		const description = readOptionalString(
			field.description,
			`${path}[${index}].description`,
			issues,
		);
		const input = readSchemaObject(
			field.input,
			`${path}[${index}].input`,
			issues,
		);
		if (!input) {
			continue;
		}
		const inputType = readString(
			input.type,
			`${path}[${index}].input.type`,
			issues,
		);
		const fieldValue = readSchemaValue(
			field.value,
			`${path}[${index}].value`,
			issues,
		);
		if (id && label && inputType) {
			fields.push({
				...field,
				id,
				label,
				input,
				...(typeof fieldValue === "undefined" ? {} : { value: fieldValue }),
				...(description ? { description } : {}),
			});
		}
	}
	return fields;
}

function readArrayOfObjects(
	value: unknown,
	path: string,
	issues: string[],
): Record<string, unknown>[] | null {
	if (!Array.isArray(value)) {
		issues.push(`${path}: expected array`);
		return null;
	}
	const items: Record<string, unknown>[] = [];
	for (const [index, item] of value.entries()) {
		if (!isRecord(item)) {
			issues.push(`${path}[${index}]: expected object`);
			continue;
		}
		items.push(item);
	}
	return items;
}

export function parseProjectionSpeechRequest(
	speech: unknown,
): ProjectionSpeechParseResult {
	if (!isRecord(speech)) {
		return {
			ok: false,
			issues: ["speech: expected object"],
		};
	}
	const issues: string[] = [];
	const id = readString(speech.id, "speech.id", issues);
	const text = readString(speech.text, "speech.text", issues);
	let status: ProjectionSpeechRequest["status"] | null = null;
	if (speech.status === "pending" || speech.status === "acknowledged") {
		status = speech.status;
	} else {
		issues.push("speech.status: required");
	}
	const voice = readOptionalString(speech.voice, "speech.voice", issues);
	if (!id || !text || status === null || issues.length > 0) {
		return { ok: false, issues };
	}
	return {
		ok: true,
		speech: {
			id,
			text,
			status,
			...(voice ? { voice } : {}),
		},
	};
}

export function parseProjectionDocument(
	document: unknown,
): ProjectionDocumentParseResult {
	if (!isRecord(document)) {
		return {
			ok: false,
			issues: ["document: expected object"],
		};
	}

	const issues: string[] = [];
	const id = readString(document.id, "id", issues);
	const revision = readString(document.revision, "revision", issues);
	const title = readOptionalString(document.title, "title", issues);
	if (!Array.isArray(document.nodes)) {
		return {
			ok: false,
			issues: ["nodes: expected array"],
		};
	}

	const nodes: ProjectionDocumentNode[] = [];
	for (const [index, node] of document.nodes.entries()) {
		if (!isRecord(node)) {
			issues.push(`nodes[${index}]: expected object`);
			continue;
		}
		const base = readNodeBase(node, `nodes[${index}]`, issues);
		if (!base) {
			continue;
		}

		switch (base.kind) {
			case "text": {
				const text = readString(node.text, `nodes[${index}].text`, issues);
				if (text) {
					nodes.push({
						...node,
						kind: "text",
						id: base.id,
						text,
					});
				}
				break;
			}
			case "checklist": {
				const items = readChecklistItems(
					node.items,
					`nodes[${index}].items`,
					issues,
				);
				if (items) {
					nodes.push({
						...node,
						kind: "checklist",
						id: base.id,
						items,
					});
				}
				break;
			}
			case "action": {
				const actionNode = readActionNode(node, `nodes[${index}]`, issues);
				if (actionNode) {
					nodes.push(actionNode);
				}
				break;
			}
			case "form": {
				const fields = readFormFields(
					node.fields,
					`nodes[${index}].fields`,
					issues,
				);
				let submit: ProjectionActionNode | undefined;
				if (typeof node.submit !== "undefined") {
					if (!isRecord(node.submit)) {
						issues.push(`nodes[${index}].submit: expected object`);
					} else {
						const parsedSubmit = readActionNode(
							node.submit,
							`nodes[${index}].submit`,
							issues,
						);
						if (parsedSubmit) {
							submit = parsedSubmit;
						}
					}
				}
				const title = readOptionalString(
					node.title,
					`nodes[${index}].title`,
					issues,
				);
				if (fields) {
					nodes.push({
						...node,
						kind: "form",
						id: base.id,
						fields,
						...(title ? { title } : {}),
						...(submit ? { submit } : {}),
					});
				}
				break;
			}
			case "table": {
				const columnsInput = readArrayOfObjects(
					node.columns,
					`nodes[${index}].columns`,
					issues,
				);
				const rowsInput = readArrayOfObjects(
					node.rows,
					`nodes[${index}].rows`,
					issues,
				);
				if (columnsInput && rowsInput) {
					const columns: ProjectionTableNode["columns"][number][] = [];
					const rows: ProjectionTableNode["rows"][number][] = [];
					for (const [columnIndex, column] of columnsInput.entries()) {
						const columnId = readString(
							column.id,
							`nodes[${index}].columns[${columnIndex}].id`,
							issues,
						);
						const label = readString(
							column.label,
							`nodes[${index}].columns[${columnIndex}].label`,
							issues,
						);
						if (columnId && label) {
							columns.push({
								...column,
								id: columnId,
								label,
							});
						}
					}
					for (const [rowIndex, row] of rowsInput.entries()) {
						const rowId = readString(
							row.id,
							`nodes[${index}].rows[${rowIndex}].id`,
							issues,
						);
						if (!Array.isArray(row.cells)) {
							issues.push(
								`nodes[${index}].rows[${rowIndex}].cells: expected array`,
							);
							continue;
						}
						const cells: IgniteSchemaValue[] = [];
						for (const [cellIndex, cell] of row.cells.entries()) {
							const parsedCell = readSchemaValue(
								cell,
								`nodes[${index}].rows[${rowIndex}].cells[${cellIndex}]`,
								issues,
							);
							if (typeof parsedCell !== "undefined") {
								cells.push(parsedCell);
							}
						}
						if (rowId) {
							rows.push({
								...row,
								id: rowId,
								cells,
							});
						}
					}
					nodes.push({
						...node,
						kind: "table",
						id: base.id,
						columns,
						rows,
					});
				}
				break;
			}
			case "timeline": {
				const events = readArrayOfObjects(
					node.events,
					`nodes[${index}].events`,
					issues,
				);
				if (events) {
					const parsedEvents: ProjectionTimelineNode["events"][number][] = [];
					for (const [eventIndex, event] of events.entries()) {
						const eventId = readString(
							event.id,
							`nodes[${index}].events[${eventIndex}].id`,
							issues,
						);
						const label = readString(
							event.label,
							`nodes[${index}].events[${eventIndex}].label`,
							issues,
						);
						const timestamp = readString(
							event.timestamp,
							`nodes[${index}].events[${eventIndex}].timestamp`,
							issues,
						);
						const detail = readOptionalString(
							event.detail,
							`nodes[${index}].events[${eventIndex}].detail`,
							issues,
						);
						if (eventId && label && timestamp) {
							parsedEvents.push({
								...event,
								id: eventId,
								label,
								timestamp,
								...(detail ? { detail } : {}),
							});
						}
					}
					nodes.push({
						...node,
						kind: "timeline",
						id: base.id,
						events: parsedEvents,
					});
				}
				break;
			}
			case "chart": {
				let chartType: ProjectionChartNode["chartType"] | null = null;
				if (
					node.chartType === "bar" ||
					node.chartType === "line" ||
					node.chartType === "pie"
				) {
					chartType = node.chartType;
				} else {
					issues.push(`nodes[${index}].chartType: required`);
				}
				const series = readArrayOfObjects(
					node.series,
					`nodes[${index}].series`,
					issues,
				);
				if (series && chartType !== null) {
					const parsedSeries: ProjectionChartNode["series"][number][] = [];
					for (const [seriesIndex, entry] of series.entries()) {
						const seriesId = readString(
							entry.id,
							`nodes[${index}].series[${seriesIndex}].id`,
							issues,
						);
						const label = readString(
							entry.label,
							`nodes[${index}].series[${seriesIndex}].label`,
							issues,
						);
						const value = readNumber(
							entry.value,
							`nodes[${index}].series[${seriesIndex}].value`,
							issues,
						);
						if (seriesId && label && value !== null) {
							parsedSeries.push({
								...entry,
								id: seriesId,
								label,
								value,
							});
						}
					}
					nodes.push({
						...node,
						kind: "chart",
						id: base.id,
						chartType,
						series: parsedSeries,
					});
				}
				break;
			}
			case "code-diff": {
				const language = readOptionalString(
					node.language,
					`nodes[${index}].language`,
					issues,
				);
				const before = readOptionalString(
					node.before,
					`nodes[${index}].before`,
					issues,
				);
				const after = readOptionalString(
					node.after,
					`nodes[${index}].after`,
					issues,
				);
				nodes.push({
					...node,
					kind: "code-diff",
					id: base.id,
					...(language ? { language } : {}),
					...(before ? { before } : {}),
					...(after ? { after } : {}),
				});
				break;
			}
			case "decision-log": {
				const entries = readArrayOfObjects(
					node.entries,
					`nodes[${index}].entries`,
					issues,
				);
				if (entries) {
					const parsedEntries: ProjectionDecisionLogNode["entries"][number][] =
						[];
					for (const [entryIndex, entry] of entries.entries()) {
						const entryId = readString(
							entry.id,
							`nodes[${index}].entries[${entryIndex}].id`,
							issues,
						);
						const title = readString(
							entry.title,
							`nodes[${index}].entries[${entryIndex}].title`,
							issues,
						);
						const decision = readString(
							entry.decision,
							`nodes[${index}].entries[${entryIndex}].decision`,
							issues,
						);
						const rationale = readOptionalString(
							entry.rationale,
							`nodes[${index}].entries[${entryIndex}].rationale`,
							issues,
						);
						if (entryId && title && decision) {
							parsedEntries.push({
								...entry,
								id: entryId,
								title,
								decision,
								...(rationale ? { rationale } : {}),
							});
						}
					}
					nodes.push({
						...node,
						kind: "decision-log",
						id: base.id,
						entries: parsedEntries,
					});
				}
				break;
			}
			default:
				issues.push(`nodes[${index}].kind: unsupported kind "${base.kind}"`);
		}
	}

	if (!id || !revision || issues.length > 0) {
		return { ok: false, issues };
	}

	return {
		ok: true,
		document: {
			...document,
			id,
			revision,
			...(title ? { title } : {}),
			nodes,
		},
	};
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
		const normalizedKey = key.toLowerCase();
		if (
			forbiddenKeys.has(normalizedKey) ||
			eventHandlerKeyPattern.test(normalizedKey)
		) {
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
):
	| { ok: true; document: ProjectionDocument }
	| {
			ok: false;
			code: "document-mismatch" | "stale-revision";
			reason: string;
	  } {
	if (document.id !== patch.documentId) {
		return {
			ok: false,
			code: "document-mismatch",
			reason: `Projection patch target "${patch.documentId}" does not match document "${document.id}".`,
		};
	}
	if (document.revision !== patch.baseRevision) {
		return {
			ok: false,
			code: "stale-revision",
			reason: `Projection patch base revision "${patch.baseRevision}" does not match current revision "${document.revision}".`,
		};
	}
	if (patch.revision === patch.baseRevision) {
		return {
			ok: false,
			code: "stale-revision",
			reason: `Projection patch revision "${patch.revision}" must advance beyond base revision "${patch.baseRevision}".`,
		};
	}

	switch (patch.type) {
		case "set-node": {
			const nextNodes = document.nodes.filter(
				(node) => node.id !== patch.node.id,
			);
			nextNodes.push(patch.node);
			return {
				ok: true,
				document: {
					...document,
					revision: patch.revision,
					nodes: nextNodes,
				},
			};
		}
		case "remove-node":
			return {
				ok: true,
				document: {
					...document,
					revision: patch.revision,
					nodes: document.nodes.filter((node) => node.id !== patch.nodeId),
				},
			};
	}
}

export function isPendingSpeechRequest(
	speech: ProjectionSpeechRequest | null | undefined,
): speech is ProjectionSpeechRequest {
	return speech?.status === "pending";
}

export function validateProjectionSelection(
	document: ProjectionDocument,
	inspection: {
		schema: IgniteAgentSchema<IgniteSchemaValue, IgniteSchemaValue>;
		canExecute(commandName: string): boolean;
	},
): string[] {
	return validateProjectionDocument(document, {
		schema: inspection.schema,
		canExecute: inspection.canExecute,
	});
}
