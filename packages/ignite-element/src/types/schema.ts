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

export type IgniteAgentSchema<
	State = IgniteSchemaValue,
	View = IgniteSchemaValue,
> = {
	commands: IgniteAgentCommandSchema;
	events: string[];
	state: State;
	view: View;
};
