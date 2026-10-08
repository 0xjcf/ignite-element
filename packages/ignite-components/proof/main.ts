import { createStatusPillCore } from "../src/status-pill/status-pill.core";
import { statusPillGallery } from "../src/status-pill/status-pill.gallery";
import { statusPillView } from "../src/status-pill/status-pill.view";

const TAG = "status-pill";
createStatusPillCore()(TAG, statusPillView);

const gallery = document.querySelector("#gallery");
if (!gallery) throw new Error("missing gallery");

const apps = ["DevTools", "Twilight", "Booster Budget", "Catalog"] as const;

for (const app of apps) {
	const fixtures = statusPillGallery.filter((fixture) =>
		app === "Catalog" ? !fixture.app : fixture.app === app,
	);
	if (fixtures.length === 0) continue;
	const section = document.createElement("section");
	const heading = document.createElement("h2");
	heading.textContent = app;
	section.append(heading);
	for (const fixture of fixtures) {
		const row = document.createElement("div");
		row.className = "fixture";
		const meta = document.createElement("div");
		meta.className = "meta";
		meta.textContent = fixture.title;
		const pill = document.createElement(TAG);
		pill.setAttribute("value", fixture.input.value);
		pill.setAttribute("tone", fixture.input.tone);
		if (fixture.input.reason) pill.setAttribute("reason", fixture.input.reason);
		row.append(meta, pill);
		section.append(row);
	}
	gallery.append(section);
}
