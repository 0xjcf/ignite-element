import { createActionButtonCore } from "../src/action-button/action-button.core";
import { actionButtonGallery } from "../src/action-button/action-button.gallery";
import { actionButtonView } from "../src/action-button/action-button.view";

const TAG = "action-button";
createActionButtonCore()(TAG, actionButtonView);

const gallery = document.querySelector("#gallery");
if (!gallery) throw new Error("missing gallery");

const apps = ["Catalog", "DevTools", "Twilight", "Booster Budget"] as const;

for (const app of apps) {
	const fixtures = actionButtonGallery.filter((fixture) =>
		app === "Catalog" ? !fixture.app : fixture.app === app,
	);
	if (fixtures.length === 0) continue;
	const section = document.createElement("section");
	const heading = document.createElement("h2");
	heading.textContent = app;
	section.append(heading);
	const rows: Array<{
		button: HTMLElement & {
			setPendingLabel: (value: string | null) => void;
			press: () => void;
			refuse: (reason: string | null) => void;
		};
		fixture: (typeof fixtures)[number];
	}> = [];
	for (const fixture of fixtures) {
		const row = document.createElement("div");
		row.className = "fixture";
		const meta = document.createElement("div");
		meta.className = "meta";
		meta.textContent = fixture.title;
		const button = document.createElement(TAG) as HTMLElement & {
			setPendingLabel: (value: string | null) => void;
			press: () => void;
			refuse: (reason: string | null) => void;
		};
		button.setAttribute("label", fixture.input.label);
		row.append(meta, button);
		section.append(row);
		rows.push({ button, fixture });
	}
	gallery.append(section);
	for (const { button, fixture } of rows) {
		button.setPendingLabel(fixture.input.pendingLabel);
		if (fixture.input.phase === "pending") button.press();
		if (fixture.input.phase === "unavailable") {
			button.refuse(fixture.input.reason);
		}
	}
}
