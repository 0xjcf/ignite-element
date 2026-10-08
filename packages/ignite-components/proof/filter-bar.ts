import { createFilterBarCore } from "../src/filter-bar/filter-bar.core";
import { filterBarGallery } from "../src/filter-bar/filter-bar.gallery";
import { filterBarView } from "../src/filter-bar/filter-bar.view";

const TAG = "catalog-filter-bar";
createFilterBarCore()(TAG, filterBarView);

const gallery = document.querySelector("#gallery");
if (!gallery) throw new Error("missing gallery");

const apps = ["DevTools", "Booster Budget"] as const;

for (const app of apps) {
	const fixtures = filterBarGallery.filter((fixture) => fixture.app === app);
	const section = document.createElement("section");
	const heading = document.createElement("h2");
	heading.textContent = app;
	section.append(heading);
	const rows: Array<{
		bar: HTMLElement & {
			setQuery: (query: string | null) => void;
			setFilters: (filters: string | null) => void;
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
		const bar = document.createElement(TAG) as HTMLElement & {
			setQuery: (query: string | null) => void;
			setFilters: (filters: string | null) => void;
			setActive: (active: string | null) => void;
		};
		bar.setAttribute("label", fixture.input.label);
		row.append(meta, bar);
		section.append(row);
		rows.push({ bar, fixture });
	}
	gallery.append(section);
	for (const { bar, fixture } of rows) {
		bar.setFilters(fixture.input.filters);
		bar.setQuery(fixture.input.query);
		bar.setActive(fixture.input.active);
	}
}
