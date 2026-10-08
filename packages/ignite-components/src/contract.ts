export type FlagKind = "can" | "show" | "is";

export type ContractFlag = {
	name: string;
	kind: FlagKind;
	/** States field that explains the flag. Null while the flag is true. */
	reasonField: string;
	/** The sentence used when the flag is false. */
	reason: string;
};

export type ContractCommand = {
	name: string;
	/**
	 * `configuration` is how the host sets a prop.
	 * `action` is something the person invokes.
	 */
	kind: "configuration" | "action";
	flag?: string;
	attribute?: string;
};

export type CatalogSurface = {
	web: string;
	pwa: string;
	/** Recorded for M3. This package does not ship a CLI host. */
	cli: string;
	/** Recorded for M3. This package does not ship an MCP host. */
	mcp: string;
};

/**
 * One web behavior and the CLI and MCP equivalents.
 * The hosts are still M3. Headless `states` carry the live values.
 */
export type A11yEquivalent = {
	web: string;
	cli: string;
	mcp: string;
};

/** Values a headless host can read without a document. */
export type HeadlessA11y = {
	cli: string | null;
	mcp: {
		value: string;
		tone: string;
		label: string;
		reason: string | null;
		status: string;
		instanceId: string;
		warnings: readonly string[];
		focusTarget: string | null;
		errors: readonly { field: string; message: string; hint: string | null }[];
		isError: boolean;
	};
};

export type ComponentContract = {
	name: string;
	states: readonly string[];
	flags: readonly ContractFlag[];
	commands: readonly ContractCommand[];
	events: readonly string[];
	slots: readonly string[];
	tokens: readonly string[];
	layers: {
		tokens: boolean;
		props: boolean;
		slots: boolean;
		headless: boolean;
	};
	surfaces: CatalogSurface;
	/** CLI and MCP hosts are M3. The contract records the mapping only. */
	hosts: {
		cli: "M3";
		mcp: "M3";
	};
	/** Present on components whose accessibility gaps are closed. */
	a11y?: readonly A11yEquivalent[];
};

export type GalleryApp = "DevTools" | "Twilight" | "Booster Budget";

export type GalleryFixture<TInput extends Record<string, unknown>> = {
	id: string;
	state: string;
	title: string;
	app?: GalleryApp;
	input: TInput;
};
