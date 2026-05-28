export type IgniteSchemaObject = { [key: string]: IgniteSchemaValue };

export type IgniteSchemaValue =
	| null
	| boolean
	| number
	| string
	| IgniteSchemaValue[]
	| IgniteSchemaObject;

export type IgniteAgentCommandSchema = Record<string, IgniteSchemaObject>;

export type IgniteAgentSchema<State = IgniteSchemaValue> = {
	commands: IgniteAgentCommandSchema;
	events: string[];
	state: State;
};
