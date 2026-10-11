export type TagSpec =
	| { kind: "input"; type: string }
	| { kind: "textarea" }
	| { kind: "select"; multiple: boolean }
	| { kind: "div" }
	| { kind: "custom" };

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
	options: OptionSpec[];
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
	text: string;
};

export type ResetReport = {
	updated: ControlSnapshot;
	fresh: ControlSnapshot;
	mounts: number;
	unmounts: number;
	optionCountBefore: number;
	optionCountAfter: number;
	sameOptionNodes: boolean;
};
