import { createExportButtonCore } from "../src/export-button/export-button.core";
import { exportButtonGallery } from "../src/export-button/export-button.gallery";
import { exportButtonView } from "../src/export-button/export-button.view";

const TAG = "catalog-export-button";
createExportButtonCore()(TAG, exportButtonView);

const gallery = document.querySelector("#gallery");
if (!gallery) throw new Error("missing gallery");

const apps = ["DevTools", "Booster Budget"] as const;

for (const app of apps) {
	const fixtures = exportButtonGallery.filter((fixture) => fixture.app === app);
	const section = document.createElement("section");
	const heading = document.createElement("h2");
	heading.textContent = app;
	section.append(heading);
	const rows: Array<{
		button: HTMLElement & {
			export: () => void;
			succeed: () => void;
			fail: (reason: string | null) => void;
			setReadyLabel: (readyLabel: string | null) => void;
		};
		fixture: (typeof fixtures)[number];
	}> = [];
	for (const fixture of fixtures) {
		const row = document.createElement("div");
		row.className = "fixture";
		const meta = document.createElement("p");
		meta.className = "meta";
		meta.textContent = fixture.title;
		const button = document.createElement(TAG) as HTMLElement & {
			export: () => void;
			succeed: () => void;
			fail: (reason: string | null) => void;
			setReadyLabel: (readyLabel: string | null) => void;
		};
		button.setAttribute("label", fixture.input.label);
		row.append(meta, button);
		section.append(row);
		rows.push({ button, fixture });
	}
	gallery.append(section);
	for (const { button, fixture } of rows) {
		button.setReadyLabel(fixture.input.readyLabel);
		if (fixture.input.phase !== "idle") button.export();
		if (fixture.input.phase === "ready") button.succeed();
		if (fixture.input.phase === "failed") button.fail(fixture.input.reason);
	}
}
