export type TagSpec =
	| { kind: "input"; type: string }
	| { kind: "textarea" }
	| { kind: "select"; multiple: boolean }
	| { kind: "div" }
	| { kind: "custom" }
	| { kind: "audio" }
	| { kind: "label" }
	| { kind: "form" };

// Native props the allowlist leaves alone. A drop must not change the
// property and must not write or remove an attribute.
export const OFF_LIST_PROPS = [
	"volume",
	"playbackRate",
	"currentTime",
	"defaultValue",
	"defaultChecked",
	"defaultSelected",
] as const;

const OFF_LIST_ATTR: Record<string, string> = {
	defaultValue: "value",
	defaultChecked: "checked",
	defaultSelected: "selected",
};

export function offListAttribute(key: string): string {
	return OFF_LIST_ATTR[key] ?? key;
}

export type OptionSpec = {
	value: string;
	text: string;
	defaultSelected: boolean;
	selected: boolean | null;
};

export type ResetScenario = {
	tag: TagSpec;
	props: Record<string, string | number | boolean>;
	drop: string[];
	// Keys present on the next render with an explicit false, not omitted.
	falses: string[];
	options: OptionSpec[];
};

export type AliasScenario = {
	kind: "attr" | "event";
	tag: string;
	fromKey: string;
	toKey: string;
	value: string;
	next: string;
};

export type AliasReport = {
	updatedAttrs: [string, string][];
	freshAttrs: [string, string][];
	firstCalls: number;
	secondCalls: number;
};

export type ValueSpec =
	| { kind: "string"; value: string }
	| { kind: "array"; values: string[] }
	| { kind: "boxed"; value: string }
	| { kind: "toString"; value: string }
	| { kind: "primitive"; value: string };

export type SinkSurface =
	| "href"
	| "src"
	| "action"
	| "formaction"
	| "srcdoc"
	| "handler"
	| "animate"
	| "set"
	| "meta";

export type SinkScenario = {
	surface: SinkSurface;
	value: ValueSpec;
	next: ValueSpec;
	handlerName: string;
	attributeName: ValueSpec;
	metaKey: string;
};

export type ControlSnapshot = {
	value: string | null;
	defaultValue: string | null;
	checked: boolean | null;
	defaultChecked: boolean | null;
	scrollTop: number;
	scrollLeft: number;
	attrs: [string, string][];
	options: {
		value: string;
		selected: boolean;
		defaultSelected: boolean;
		attrs: [string, string][];
	}[];
	label: string | null;
	count: number | null;
	probeDefaultSelected: boolean | null;
	text: string;
};

export type OffListReading = {
	key: string;
	before: string | number | boolean | null;
	after: string | number | boolean | null;
	attrBefore: string | null;
	attrAfter: string | null;
};

export type ResetReport = {
	updated: ControlSnapshot;
	fresh: ControlSnapshot;
	offList: OffListReading[];
	mounts: number;
	unmounts: number;
	optionCountBefore: number;
	optionCountAfter: number;
	sameOptionNodes: boolean;
};
