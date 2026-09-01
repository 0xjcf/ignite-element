export type IgniteSchemaObject = { [key: string]: IgniteSchemaValue };

export type IgniteSchemaValue =
	| null
	| boolean
	| number
	| string
	| IgniteSchemaValue[]
	| IgniteSchemaObject;

export type IgniteAgentCommandContract = IgniteSchemaObject & {
	gated?: boolean;
};

export type IgniteAgentCommandSchema = Record<
	string,
	IgniteAgentCommandContract
>;

export type IgniteAgentEventSchema = IgniteSchemaObject & {
	type: string;
};

export type IgniteAgentSchema<
	Snapshot = IgniteSchemaValue,
	States = IgniteSchemaValue,
> = {
	commands: IgniteAgentCommandSchema;
	events: IgniteAgentEventSchema[];
	snapshot: Snapshot;
	states: States;
};
