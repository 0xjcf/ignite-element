import { igniteCore } from "ignite-element/xstate";
import type { SnapshotFrom } from "xstate";
import {
	activeIn,
	parseTabs,
	type TabsEvent,
	tabsMachine,
} from "./tabs.source";

export type TabsStateName = "empty" | "open" | "selected";

export type TabsStates = {
	state: TabsStateName;
	label: string;
	items: string[];
	active: string | null;
	showTabs: boolean;
	showTabsRefusal: string | null;
	canSelect: boolean;
	canSelectRefusal: string | null;
	isSelected: boolean;
	isSelectedRefusal: string | null;
};

export type TabsCommands = {
	setLabel: (label: string | null) => void;
	setItems: (items: string | null) => void;
	setActive: (active: string | null) => void;
	select: (id: string | null) => void;
};

const NO_TABS = "There are no tabs.";
const NONE_SELECTED = "No tab is selected.";

export function projectTabs(
	snapshot: SnapshotFrom<typeof tabsMachine>,
): TabsStates {
	const items = [...snapshot.context.items];
	const active = activeIn(items, snapshot.context.active);
	const showTabs = items.length > 0;
	const selected = snapshot.matches("selected");
	return {
		state: snapshot.matches("empty") ? "empty" : selected ? "selected" : "open",
		label: snapshot.context.label,
		items,
		active,
		showTabs,
		showTabsRefusal: showTabs ? null : NO_TABS,
		canSelect: showTabs,
		canSelectRefusal: showTabs ? null : NO_TABS,
		isSelected: selected,
		isSelectedRefusal: selected ? null : NONE_SELECTED,
	};
}

export function tabsCommands(source: {
	send: (event: TabsEvent) => void;
}): TabsCommands {
	return {
		setLabel: (label) => {
			const next = label?.trim() ? label.trim() : "Tabs";
			source.send({ type: "SET_LABEL", label: next });
		},
		setItems: (items) => {
			source.send({ type: "SET_ITEMS", items: parseTabs(items) });
		},
		setActive: (active) => {
			source.send({ type: "SET_ACTIVE", active });
		},
		select: (id) => {
			const name = id?.trim() ?? "";
			if (name.length === 0) return;
			source.send({ type: "SELECT", id: name });
		},
	};
}

export const tabsProjection = {
	states: projectTabs,
	commands: ({ source }: { source: Parameters<typeof tabsCommands>[0] }) =>
		tabsCommands(source),
};

export function createTabsCore() {
	return igniteCore({
		source: tabsMachine,
		states: projectTabs,
		commands: ({ source }) => tabsCommands(source),
		events: (event) => ({
			select: event<{ id: string }>(),
		}),
	});
}
