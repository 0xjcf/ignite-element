import type {
	ArrayCommandInputOptions,
	BooleanCommandInputOptions,
	CommandHelper,
	CommandInputMetadata,
	CommandMetadata,
	CommandWithMetadata,
	EnumCommandInputOptions,
	FacadeCommandFunction,
	NumberCommandInputOptions,
	ObjectCommandInputOptions,
	ObjectCommandInputProperties,
	StringCommandInputOptions,
} from "ignite-core";

export const commandMetadataSymbol = Symbol.for("ignite.command.metadata");

const attachCommandMetadata = <Command extends FacadeCommandFunction>(
	commandFunction: Command,
	metadata?: CommandMetadata,
): CommandWithMetadata<Command> => {
	if (metadata === undefined) {
		return commandFunction as CommandWithMetadata<Command>;
	}

	const wrappedCommand = function (this: unknown, ...args: unknown[]) {
		return (
			commandFunction as unknown as (
				this: unknown,
				...args: unknown[]
			) => unknown
		).apply(this, args);
	} as unknown as CommandWithMetadata<Command>;

	Object.defineProperty(wrappedCommand, commandMetadataSymbol, {
		configurable: true,
		enumerable: false,
		value: metadata,
		writable: false,
	});

	return wrappedCommand;
};

export const command: CommandHelper = Object.assign(attachCommandMetadata, {
	number(options: NumberCommandInputOptions = {}) {
		return {
			type: "number" as const,
			...options,
		};
	},
	string(options: StringCommandInputOptions = {}) {
		return {
			type: "string" as const,
			...options,
		};
	},
	boolean(options: BooleanCommandInputOptions = {}) {
		return {
			type: "boolean" as const,
			...options,
		};
	},
	enum<const Values extends readonly [string, ...string[]]>(
		values: Values,
		options: EnumCommandInputOptions<Values[number]> = {},
	) {
		return {
			type: "string" as const,
			enum: [...values],
			...options,
		};
	},
	object(
		properties: ObjectCommandInputProperties = {},
		options: ObjectCommandInputOptions = {},
	) {
		return {
			type: "object" as const,
			properties,
			...options,
		};
	},
	array(
		items?: CommandInputMetadata,
		options: ArrayCommandInputOptions = {},
	) {
		return {
			type: "array" as const,
			...(typeof items === "undefined" ? {} : { items }),
			...options,
		};
	},
});
