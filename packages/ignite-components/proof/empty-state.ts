import { createEmptyStateCore } from "../src/empty-state/empty-state.core";
import { emptyStateGallery } from "../src/empty-state/empty-state.gallery";
import { emptyStateView } from "../src/empty-state/empty-state.view";

const TAG = "empty-state";
createEmptyStateCore()(TAG, emptyStateView);

const gallery = document.querySelector("#gallery");
if (!gallery) throw new Error("missing gallery");

const apps = ["DevTools", "Twilight", "Booster Budget"] as const;

for (const app of apps) {
	const fixtures = emptyStateGallery.filter((fixture) => fixture.app === app);
	const section = document.createElement("section");
	const heading = document.createElement("h2");
	heading.textContent = app;
	section.append(heading);
	const rows: Array<{
		panel: HTMLElement & {
			setKind: (kind: string | null) => void;
			setActionLabel: (label: string | null) => void;
		};
		fixture: (typeof fixtures)[number];
	}> = [];
	for (const fixture of fixtures) {
		const row = document.createElement("div");
		row.className = "fixture";
		const meta = document.createElement("p");
		meta.className = "meta";
		meta.textContent = fixture.title;
		const panel = document.createElement(TAG) as HTMLElement & {
			setKind: (kind: string | null) => void;
			setActionLabel: (label: string | null) => void;
		};
		panel.setAttribute("title", fixture.input.title);
		panel.setAttribute("message", fixture.input.message);
		row.append(meta, panel);
		section.append(row);
		rows.push({ panel, fixture });
	}
	gallery.append(section);
	for (const { panel, fixture } of rows) {
		panel.setKind(fixture.input.kind);
		panel.setActionLabel(fixture.input.actionLabel);
	}
}
