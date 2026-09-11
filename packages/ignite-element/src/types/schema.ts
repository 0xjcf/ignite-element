export type IgniteSchemaObject = { [key: string]: IgniteSchemaValue };

export type IgniteSchemaValue =
	| null
	| boolean
	| number
	| string
	| IgniteSchemaValue[]
	| IgniteSchemaObject;

export type IgniteAgentCommandContract = {
	readonly input: null;
};

export type IgniteAgentCommandSchema = Record<
	string,
	IgniteAgentCommandContract
>;

export type IgniteAgentEventSchema = {
	readonly type: string;
	readonly payload: null;
};

export type IgniteAgentSchema<
	_Snapshot = IgniteSchemaValue,
	_States = IgniteSchemaValue,
> = {
	readonly schemaVersion: 1;
	readonly commands: Readonly<IgniteAgentCommandSchema> | null;
	readonly events: readonly IgniteAgentEventSchema[];
	readonly states: { readonly schema: null };
};
