import type {
	CommandHelper,
	CommandMetadata,
	CommandWithMetadata,
	FacadeCommandFunction,
	NumberCommandInputOptions,
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
});
