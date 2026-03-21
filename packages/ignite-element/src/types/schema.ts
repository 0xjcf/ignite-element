export type IgniteSchemaValue =
	| null
	| boolean
	| number
	| string
	| IgniteSchemaValue[]
	| { [key: string]: IgniteSchemaValue };

export type IgniteAgentSchema<State = IgniteSchemaValue> = {
	commands: string[];
	events: string[];
	state: State;
};
