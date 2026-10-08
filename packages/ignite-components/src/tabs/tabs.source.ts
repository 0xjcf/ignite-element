import { assign, emit, setup } from "xstate";

export type TabsInput = {
	label?: string;
	items?: readonly string[];
	active?: string | null;
};

export type TabsContext = {
	label: string;
	items: string[];
	active: string | null;
};

export type TabsEvent =
	| { type: "SET_LABEL"; label: string }
	| { type: "SET_ITEMS"; items: string[] }
	| { type: "SET_ACTIVE"; active: string | null }
	| { type: "SELECT"; id: string };

export type TabsEmitted = { type: "select"; id: string };

/** Trim, drop blanks, and keep the first copy of a repeated name. */
export function normalizeTabItems(items: readonly string[]): string[] {
	const seen = new Set<string>();
	const next: string[] = [];
	for (const item of items) {
		const name = item.trim();
		if (name.length === 0 || seen.has(name)) continue;
		seen.add(name);
		next.push(name);
	}
	return next;
}

/** Trim, drop blanks, and keep the first copy of a repeated name. */
export function parseTabs(value: string | null): string[] {
	if (value === null) return [];
	return normalizeTabItems(value.split("\n"));
}

export function activeIn(
	items: readonly string[],
	active: string | null,
): string | null {
	if (active === null) return null;
	const name = active.trim();
	if (name.length === 0 || !items.includes(name)) return null;
	return name;
}

/**
 * The host owns the panel. Selecting a tab records the name and tells the host.
 * A name that is not in the list is ignored.
 */
export const tabsMachine = setup({
	types: {
		context: {} as TabsContext,
		events: {} as TabsEvent,
		emitted: {} as TabsEmitted,
		input: {} as TabsInput,
	},
	actions: {
		applyLabel: assign({
			label: ({ event }) => (event.type === "SET_LABEL" ? event.label : "Tabs"),
		}),
		applyItems: assign({
			items: ({ event }) => (event.type === "SET_ITEMS" ? event.items : []),
			active: ({ context, event }) =>
				event.type === "SET_ITEMS"
					? activeIn(event.items, context.active)
					: context.active,
		}),
		applyActive: assign({
			active: ({ context, event }) =>
				event.type === "SET_ACTIVE"
					? activeIn(context.items, event.active)
					: context.active,
		}),
		applySelect: assign({
			active: ({ event }) => (event.type === "SELECT" ? event.id : null),
		}),
		announceSelect: emit(({ event }) => ({
			type: "select" as const,
			id: event.type === "SELECT" ? event.id : "",
		})),
	},
	guards: {
		hasItems: ({ context }) => context.items.length > 0,
		lacksItems: ({ context }) => context.items.length === 0,
		hasActive: ({ context }) => context.active !== null,
		lacksActive: ({ context }) => context.active === null,
		knownTab: ({ context, event }) =>
			event.type === "SELECT" && context.items.includes(event.id),
	},
}).createMachine({
	id: "tabs",
	initial: "empty",
	context: ({ input }) => {
		const items = normalizeTabItems(input?.items ?? []);
		return {
			label: input?.label?.trim() ? input.label : "Tabs",
			items,
			active: activeIn(items, input?.active ?? null),
		};
	},
	on: {
		SET_LABEL: { actions: "applyLabel" },
		SET_ITEMS: { actions: "applyItems" },
		SET_ACTIVE: { actions: "applyActive" },
		SELECT: {
			guard: "knownTab",
			actions: ["applySelect", "announceSelect"],
		},
	},
	states: {
		empty: {
			always: [
				{ guard: "hasActive", target: "selected" },
				{ guard: "hasItems", target: "open" },
			],
		},
		open: {
			always: [
				{ guard: "lacksItems", target: "empty" },
				{ guard: "hasActive", target: "selected" },
			],
		},
		selected: {
			always: [
				{ guard: "lacksItems", target: "empty" },
				{ guard: "lacksActive", target: "open" },
			],
		},
	},
});
