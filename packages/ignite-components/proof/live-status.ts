import { createLiveStatusCore } from "../src/live-status/live-status.core";
import { liveStatusGallery } from "../src/live-status/live-status.gallery";
import { liveStatusView } from "../src/live-status/live-status.view";

const TAG = "live-status";
createLiveStatusCore()(TAG, liveStatusView);

const gallery = document.querySelector("#gallery");
if (!gallery) throw new Error("missing gallery");

const apps = ["DevTools", "Twilight", "Booster Budget", "Catalog"] as const;

for (const app of apps) {
	const fixtures = liveStatusGallery.filter((fixture) =>
		app === "Catalog" ? !fixture.app : fixture.app === app,
	);
	if (fixtures.length === 0) continue;
	const section = document.createElement("section");
	const heading = document.createElement("h2");
	heading.textContent = app;
	section.append(heading);
	const rows: Array<{
		status: HTMLElement & {
			setMessage: (message: string | null) => void;
			setPoliteness: (politeness: string | null) => void;
			setBusy: (busy: string | null) => void;
			setProgress: (progress: string | null) => void;
			setSettled: (settled: string | null) => void;
			setTone: (tone: string | null) => void;
		};
		fixture: (typeof fixtures)[number];
	}> = [];
	for (const fixture of fixtures) {
		const row = document.createElement("div");
		row.className = "fixture";
		const meta = document.createElement("p");
		meta.className = "meta";
		meta.textContent = fixture.title;
		const status = document.createElement(TAG) as HTMLElement & {
			setMessage: (message: string | null) => void;
			setPoliteness: (politeness: string | null) => void;
			setBusy: (busy: string | null) => void;
			setProgress: (progress: string | null) => void;
			setSettled: (settled: string | null) => void;
			setTone: (tone: string | null) => void;
		};
		row.append(meta, status);
		section.append(row);
		rows.push({ status, fixture });
	}
	gallery.append(section);
	for (const { status, fixture } of rows) {
		status.setTone(fixture.input.tone);
		status.setProgress(fixture.input.progress);
		if (fixture.input.settled) status.setSettled(fixture.input.settled);
		else if (fixture.input.message) {
			status.setPoliteness(fixture.input.politeness);
			status.setMessage(fixture.input.message);
		}
		if (fixture.input.busy) status.setBusy("true");
	}
}
