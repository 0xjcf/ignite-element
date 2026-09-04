export type IgniteSchemaValue =
	| null
	| boolean
	| number
	| string
	| IgniteSchemaValue[]
	| { [key: string]: IgniteSchemaValue };

export type IgniteAgentCommandSchema = Record<string, IgniteSchemaValue>;

export type IgniteAgentSchema<State = IgniteSchemaValue> = {
	commands: IgniteAgentCommandSchema;
	events: string[];
	state: State;
};
