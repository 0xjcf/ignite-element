import { createTabsCore } from "../src/tabs/tabs.core";
import { tabsGallery } from "../src/tabs/tabs.gallery";
import { tabsView } from "../src/tabs/tabs.view";

const TAG = "catalog-tabs";
createTabsCore()(TAG, tabsView);

const gallery = document.querySelector("#gallery");
if (!gallery) throw new Error("missing gallery");

const apps = ["DevTools", "Booster Budget"] as const;

for (const app of apps) {
	const fixtures = tabsGallery.filter((fixture) => fixture.app === app);
	const section = document.createElement("section");
	const heading = document.createElement("h2");
	heading.textContent = app;
	section.append(heading);
	const rows: Array<{
		tabs: HTMLElement & {
			setItems: (items: string | null) => void;
			setActive: (active: string | null) => void;
		};
		fixture: (typeof fixtures)[number];
	}> = [];
	for (const fixture of fixtures) {
		const row = document.createElement("div");
		row.className = "fixture";
		const meta = document.createElement("p");
		meta.className = "meta";
		meta.textContent = fixture.title;
		const tabs = document.createElement(TAG) as HTMLElement & {
			setItems: (items: string | null) => void;
			setActive: (active: string | null) => void;
		};
		tabs.setAttribute("label", fixture.input.label);
		row.append(meta, tabs);
		section.append(row);
		rows.push({ tabs, fixture });
	}
	gallery.append(section);
	for (const { tabs, fixture } of rows) {
		tabs.setItems(fixture.input.items);
		tabs.setActive(fixture.input.active);
	}
}
