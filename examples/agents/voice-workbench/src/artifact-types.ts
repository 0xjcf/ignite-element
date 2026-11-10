import type { IgniteSchemaValue } from "ignite-element";

type IgniteSchemaObject = { [key: string]: IgniteSchemaValue };

export type ProjectionNodeBase = {
	id: string;
};

export type ProjectionTextNode = ProjectionNodeBase & {
	kind: "text";
	text: string;
};

export type ProjectionChecklistNode = ProjectionNodeBase & {
	kind: "checklist";
	items: readonly {
		id: string;
		label: string;
		checked: boolean;
	}[];
};

export type ProjectionActionNode = ProjectionNodeBase & {
	kind: "action";
	label: string;
	commandName: string;
	payload?: IgniteSchemaValue;
	description?: string;
};

export type ProjectionFormNode = ProjectionNodeBase & {
	kind: "form";
	title?: string;
	fields: readonly {
		id: string;
		label: string;
		input: IgniteSchemaObject;
		value?: IgniteSchemaValue;
		description?: string;
	}[];
	submit?: ProjectionActionNode;
};

export type ProjectionTableNode = ProjectionNodeBase & {
	kind: "table";
	columns: readonly {
		id: string;
		label: string;
	}[];
	rows: readonly {
		id: string;
		cells: readonly IgniteSchemaValue[];
	}[];
};

export type ProjectionTimelineNode = ProjectionNodeBase & {
	kind: "timeline";
	events: readonly {
		id: string;
		label: string;
		timestamp: string;
		detail?: string;
	}[];
};

export type ProjectionChartNode = ProjectionNodeBase & {
	kind: "chart";
	chartType: "bar" | "line" | "pie";
	series: readonly {
		id: string;
		label: string;
		value: number;
	}[];
};

export type ProjectionCodeDiffNode = ProjectionNodeBase & {
	kind: "code-diff";
	language?: string;
	before?: string;
	after?: string;
};

export type ProjectionDecisionLogNode = ProjectionNodeBase & {
	kind: "decision-log";
	entries: readonly {
		id: string;
		title: string;
		decision: string;
		rationale?: string;
	}[];
};

export type ProjectionDocumentNode =
	| ProjectionTextNode
	| ProjectionChecklistNode
	| ProjectionActionNode
	| ProjectionFormNode
	| ProjectionTableNode
	| ProjectionTimelineNode
	| ProjectionChartNode
	| ProjectionCodeDiffNode
	| ProjectionDecisionLogNode;

export type ProjectionDocument = {
	id: string;
	revision: string;
	title?: string;
	nodes: readonly ProjectionDocumentNode[];
};

export type ProjectionDocumentPatch =
	| {
			type: "set-node";
			documentId: string;
			baseRevision: string;
			revision: string;
			node: ProjectionDocumentNode;
	  }
	| {
			type: "remove-node";
			documentId: string;
			baseRevision: string;
			revision: string;
			nodeId: string;
	  };

export type ProjectionSpeechRequest = {
	id: string;
	text: string;
	status: "pending" | "acknowledged";
	voice?: string;
};
