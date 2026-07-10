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

type ProjectionDocumentCollectionParseResult =
	| { ok: true; documents: ProjectionDocument[] }
	| { ok: false; issues: string[] };

type ProjectionSpeechParseResult =
	| { ok: true; speech: ProjectionSpeechRequest }
	| { ok: false; issues: string[] };

const forbiddenKeys = new Set([
	"dom",
	"domref",
	"dangerouslysetinnerhtml",
	"handler",
	"handlers",
	"html",
	"innerhtml",
	"import",
	"imports",
	"javascript",
	"jsx",
	"module",
	"modules",
	"onclick",
	"oninput",
	"outerhtml",
	"script",
	"selector",
	"srcdoc",
]);
const eventHandlerKeyPattern = /^on[a-z]/;
const uriBearingKeys = new Set([
	"action",
	"formaction",
	"href",
	"src",
	"xlink:href",
]);
const executableDataMediaTypes = new Set([
	"application/xhtml+xml",
	"image/svg+xml",
	"text/html",
]);
const uriArrayScalarBlocker = "#";

function removeAsciiWhitespaceAndControl(value: string): string {
	let normalized = "";
	for (const character of value) {
		const codePoint = character.charCodeAt(0);
		if (codePoint <= 0x20 || codePoint === 0x7f) {
			continue;
		}
		normalized += character;
	}
	return normalized;
}

function isExecutableUri(value: string): boolean {
	const normalized = removeAsciiWhitespaceAndControl(value).toLowerCase();
	if (
		normalized.startsWith("javascript:") ||
		normalized.startsWith("vbscript:")
	) {
		return true;
	}
	if (!normalized.startsWith("data:")) {
		return false;
	}

	const commaIndex = normalized.indexOf(",");
	const metadata = normalized.slice(
		"data:".length,
		commaIndex < 0 ? undefined : commaIndex,
	);
	const separatorIndex = metadata.indexOf(";");
	const mediaType = metadata.slice(
		0,
		separatorIndex < 0 ? undefined : separatorIndex,
	);
	return executableDataMediaTypes.has(mediaType);
}

function createUriArrayCandidate(value: unknown[]): string {
	let candidate = "";
	for (let index = 0; index < value.length; index += 1) {
		if (index > 0) {
			candidate += ",";
		}

		const entry: unknown = value[index];
		if (entry === null) {
			continue;
		}
		if (typeof entry === "string") {
			candidate += entry;
			continue;
		}
		if (Array.isArray(entry)) {
			candidate += createUriArrayCandidate(entry);
			continue;
		}

		candidate += uriArrayScalarBlocker;
	}
	return candidate;
}

function containsExecutableUri(value: unknown): boolean {
	if (typeof value === "string") {
		return isExecutableUri(value);
	}
	return (
		Array.isArray(value) && isExecutableUri(createUriArrayCandidate(value))
	);
}

type MaterializedObject = {
	[key: string]: MaterializedValue;
};

type MaterializedValue =
	| null
	| boolean
	| number
	| string
	| MaterializedValue[]
	| MaterializedObject;

type MaterializedValueResult =
	| { ok: true; value: MaterializedValue }
	| { ok: false };

type DenseDataArrayCopyResult = { ok: true; values: unknown[] } | { ok: false };

function joinDataPath(path: string, key: string): string {
	return path.length > 0 ? `${path}.${key}` : key;
}

function displayDataPath(path: string): string {
	return path.length > 0 ? path : "document";
}

function materializeDataProperty(
	container: object,
	key: string,
	path: string,
	issues: string[],
	active: WeakSet<object>,
): MaterializedValueResult {
	const descriptor = Object.getOwnPropertyDescriptor(container, key);
	if (!descriptor || !("value" in descriptor)) {
		issues.push(`${path}: accessor properties are not allowed`);
		return { ok: false };
	}
	if (descriptor.enumerable !== true) {
		issues.push(`${path}: non-enumerable properties are not allowed`);
		return { ok: false };
	}
	const propertyValue: unknown = descriptor.value;
	return materializeDataValue(propertyValue, path, issues, active);
}

function copyDenseDataArray(
	value: unknown,
	path: string,
	issues: string[],
): DenseDataArrayCopyResult {
	try {
		if (
			!Array.isArray(value) ||
			Object.getPrototypeOf(value) !== Array.prototype
		) {
			issues.push(`${displayDataPath(path)}: expected plain data array`);
			return { ok: false };
		}

		const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
		if (
			!lengthDescriptor ||
			!("value" in lengthDescriptor) ||
			lengthDescriptor.enumerable !== false
		) {
			issues.push(`${displayDataPath(path)}: invalid array length`);
			return { ok: false };
		}
		const lengthValue: unknown = lengthDescriptor.value;
		if (
			typeof lengthValue !== "number" ||
			!Number.isSafeInteger(lengthValue) ||
			lengthValue < 0
		) {
			issues.push(`${displayDataPath(path)}: invalid array length`);
			return { ok: false };
		}
		const length = lengthValue;

		for (const key of Reflect.ownKeys(value)) {
			if (key === "length") {
				continue;
			}
			if (typeof key !== "string") {
				issues.push(
					`${displayDataPath(path)}: symbol properties are not allowed`,
				);
				return { ok: false };
			}
			const index = Number(key);
			if (
				!Number.isSafeInteger(index) ||
				index < 0 ||
				index >= length ||
				String(index) !== key
			) {
				issues.push(`${joinDataPath(path, key)}: unexpected array property`);
				return { ok: false };
			}
		}

		const values: unknown[] = [];
		for (let index = 0; index < length; index += 1) {
			const itemPath = `${path}[${index}]`;
			const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
			if (!descriptor) {
				issues.push(`${itemPath}: sparse array entries are not allowed`);
				return { ok: false };
			}
			if (!("value" in descriptor)) {
				issues.push(`${itemPath}: accessor properties are not allowed`);
				return { ok: false };
			}
			if (descriptor.enumerable !== true) {
				issues.push(`${itemPath}: non-enumerable properties are not allowed`);
				return { ok: false };
			}
			const itemValue: unknown = descriptor.value;
			values.push(itemValue);
		}

		return { ok: true, values };
	} catch {
		issues.push(`${displayDataPath(path)}: unable to inspect data safely`);
		return { ok: false };
	}
}

function materializeDataArray(
	value: unknown[],
	path: string,
	issues: string[],
	active: WeakSet<object>,
): MaterializedValueResult {
	const copied = copyDenseDataArray(value, path, issues);
	if (!copied.ok) {
		return copied;
	}
	if (active.has(value)) {
		issues.push(`${displayDataPath(path)}: cyclic data is not allowed`);
		return { ok: false };
	}

	active.add(value);
	const output: MaterializedValue[] = [];
	for (let index = 0; index < copied.values.length; index += 1) {
		const itemPath = `${path}[${index}]`;
		const item = materializeDataValue(
			copied.values[index],
			itemPath,
			issues,
			active,
		);
		if (!item.ok) {
			active.delete(value);
			return item;
		}
		output.push(item.value);
	}
	active.delete(value);
	return { ok: true, value: output };
}

function materializeDataObject(
	value: object,
	path: string,
	issues: string[],
	active: WeakSet<object>,
): MaterializedValueResult {
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) {
		issues.push(`${displayDataPath(path)}: expected plain data object`);
		return { ok: false };
	}
	if (active.has(value)) {
		issues.push(`${displayDataPath(path)}: cyclic data is not allowed`);
		return { ok: false };
	}

	active.add(value);
	const output: MaterializedObject = {};
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key !== "string") {
			issues.push(
				`${displayDataPath(path)}: symbol properties are not allowed`,
			);
			active.delete(value);
			return { ok: false };
		}
		const propertyPath = joinDataPath(path, key);
		const property = materializeDataProperty(
			value,
			key,
			propertyPath,
			issues,
			active,
		);
		if (!property.ok) {
			active.delete(value);
			return property;
		}
		Object.defineProperty(output, key, {
			value: property.value,
			enumerable: true,
			configurable: true,
			writable: true,
		});
	}
	active.delete(value);
	return { ok: true, value: output };
}

function materializeDataValue(
	value: unknown,
	path: string,
	issues: string[],
	active: WeakSet<object>,
): MaterializedValueResult {
	try {
		if (
			value === null ||
			typeof value === "boolean" ||
			typeof value === "string"
		) {
			return { ok: true, value };
		}
		if (typeof value === "number") {
			if (Number.isFinite(value)) {
				return { ok: true, value };
			}
			issues.push(`${displayDataPath(path)}: expected finite number`);
			return { ok: false };
		}
		if (Array.isArray(value)) {
			return materializeDataArray(value, path, issues, active);
		}
		if (typeof value === "object") {
			return materializeDataObject(value, path, issues, active);
		}

		issues.push(`${displayDataPath(path)}: expected JSON-like data`);
		return { ok: false };
	} catch {
		issues.push(`${displayDataPath(path)}: unable to inspect data safely`);
		return { ok: false };
	}
}

function materializeRootObject(
	value: unknown,
	path: string,
	issues: string[],
): MaterializedObject | null {
	try {
		if (typeof value !== "object" || value === null || Array.isArray(value)) {
			issues.push(`${displayDataPath(path)}: expected object`);
			return null;
		}
		const result = materializeDataValue(value, path, issues, new WeakSet());
		return result.ok && isRecord(result.value) ? result.value : null;
	} catch {
		issues.push(`${displayDataPath(path)}: unable to inspect data safely`);
		return null;
	}
}

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
	const issues: string[] = [];
	const materializedSpeech = materializeRootObject(speech, "speech", issues);
	if (!materializedSpeech) {
		return {
			ok: false,
			issues,
		};
	}
	const id = readString(materializedSpeech.id, "speech.id", issues);
	const text = readString(materializedSpeech.text, "speech.text", issues);
	let status: ProjectionSpeechRequest["status"] | null = null;
	if (
		materializedSpeech.status === "pending" ||
		materializedSpeech.status === "acknowledged"
	) {
		status = materializedSpeech.status;
	} else {
		issues.push("speech.status: required");
	}
	const voice = readOptionalString(
		materializedSpeech.voice,
		"speech.voice",
		issues,
	);
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
	const issues: string[] = [];
	const materializedDocument = materializeRootObject(document, "", issues);
	if (!materializedDocument) {
		return {
			ok: false,
			issues,
		};
	}

	const id = readString(materializedDocument.id, "id", issues);
	const revision = readString(
		materializedDocument.revision,
		"revision",
		issues,
	);
	const title = readOptionalString(materializedDocument.title, "title", issues);
	if (!Array.isArray(materializedDocument.nodes)) {
		return {
			ok: false,
			issues: ["nodes: expected array"],
		};
	}

	const nodes: ProjectionDocumentNode[] = [];
	for (const [index, node] of materializedDocument.nodes.entries()) {
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
								id: rowId,
								cells,
							});
						}
					}
					nodes.push({
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
								id: eventId,
								label,
								timestamp,
								...(detail ? { detail } : {}),
							});
						}
					}
					nodes.push({
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
								id: seriesId,
								label,
								value,
							});
						}
					}
					nodes.push({
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
								id: entryId,
								title,
								decision,
								...(rationale ? { rationale } : {}),
							});
						}
					}
					nodes.push({
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
			id,
			revision,
			...(title ? { title } : {}),
			nodes,
		},
	};
}

export function parseProjectionDocumentCollection(
	documents: unknown,
): ProjectionDocumentCollectionParseResult {
	const issues: string[] = [];
	const copied = copyDenseDataArray(documents, "documents", issues);
	if (!copied.ok) {
		return { ok: false, issues };
	}

	const parsedDocuments: ProjectionDocument[] = [];
	const documentIds = new Set<string>();
	for (let index = 0; index < copied.values.length; index += 1) {
		const parsed = parseProjectionDocument(copied.values[index]);
		if (parsed.ok) {
			if (documentIds.has(parsed.document.id)) {
				issues.push(
					`documents[${index}].id: duplicate document id "${parsed.document.id}"`,
				);
			}
			documentIds.add(parsed.document.id);
			parsedDocuments.push(parsed.document);
			continue;
		}
		for (const issue of parsed.issues) {
			issues.push(
				issue.startsWith("document:")
					? `documents[${index}]${issue.slice("document".length)}`
					: `documents[${index}].${issue}`,
			);
		}
	}

	return issues.length > 0
		? { ok: false, issues }
		: { ok: true, documents: parsedDocuments };
}

function collectForbiddenContent(
	value: unknown,
	path: string,
	issues: string[],
): void {
	if (Array.isArray(value)) {
		for (let index = 0; index < value.length; index += 1) {
			collectForbiddenContent(value[index], `${path}[${index}]`, issues);
		}
		return;
	}

	if (!isRecord(value)) {
		return;
	}

	for (const key of Object.keys(value)) {
		const entry: unknown = value[key];
		const normalizedKey = key.toLowerCase();
		if (
			forbiddenKeys.has(normalizedKey) ||
			eventHandlerKeyPattern.test(normalizedKey)
		) {
			issues.push(`${path}.${key}: executable content is not allowed`);
		}
		if (uriBearingKeys.has(normalizedKey) && containsExecutableUri(entry)) {
			issues.push(`${path}.${key}: executable URI is not allowed`);
		}
		collectForbiddenContent(entry, `${path}.${key}`, issues);
	}
}

function validateActionNode(
	node: ProjectionActionNode,
	context: ValidationContext,
	path: string,
): string[] {
	const issues: string[] = [];
	const commandDescriptor = Object.getOwnPropertyDescriptor(
		context.schema.commands,
		node.commandName,
	);
	const command =
		commandDescriptor && "value" in commandDescriptor
			? commandDescriptor.value
			: undefined;
	if (!isRecord(command)) {
		issues.push(`${path}.commandName: unknown command "${node.commandName}"`);
		return issues;
	}

	const input = command.input;
	if (isIgniteSchemaObject(input)) {
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
	collectForbiddenContent(node, path, issues);

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
	const existingIndex = documents.findIndex(
		(entry) => entry.id === document.id,
	);
	if (existingIndex < 0) {
		return [...documents, document];
	}
	return documents.map((entry, index) =>
		index === existingIndex ? document : entry,
	);
}

export function applyProjectionDocumentPatch(
	document: ProjectionDocument,
	patch: ProjectionDocumentPatch,
):
	| { ok: true; document: ProjectionDocument }
	| {
			ok: false;
			code: "document-mismatch" | "invalid-document" | "stale-revision";
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
			const existingIndex = document.nodes.findIndex(
				(node) => node.id === patch.node.id,
			);
			const nextNodes =
				existingIndex < 0
					? [...document.nodes, patch.node]
					: document.nodes.map((node, index) =>
							index === existingIndex ? patch.node : node,
						);
			return {
				ok: true,
				document: {
					...document,
					revision: patch.revision,
					nodes: nextNodes,
				},
			};
		}
		case "remove-node": {
			const nextNodes = document.nodes.filter(
				(node) => node.id !== patch.nodeId,
			);
			if (nextNodes.length === 0) {
				return {
					ok: false,
					code: "invalid-document",
					reason: `Projection document "${document.id}" must retain at least one node.`,
				};
			}
			return {
				ok: true,
				document: {
					...document,
					revision: patch.revision,
					nodes: nextNodes,
				},
			};
		}
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
