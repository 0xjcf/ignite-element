import { createNoticeCore } from "../src/notice/notice.core";
import { noticeGallery } from "../src/notice/notice.gallery";
import { noticeView } from "../src/notice/notice.view";

const TAG = "catalog-notice";
createNoticeCore()(TAG, noticeView);

const gallery = document.querySelector("#gallery");
if (!gallery) throw new Error("missing gallery");

const apps = ["DevTools", "Twilight", "Booster Budget"] as const;

for (const app of apps) {
	const fixtures = noticeGallery.filter((fixture) => fixture.app === app);
	const section = document.createElement("section");
	const heading = document.createElement("h2");
	heading.textContent = app;
	section.append(heading);
	const rows: Array<{
		panel: HTMLElement & {
			setTone: (tone: string | null) => void;
			setActions: (actions: string | null) => void;
			setDismissible: (value: string | null) => void;
			dismiss: () => void;
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
			setTone: (tone: string | null) => void;
			setActions: (actions: string | null) => void;
			setDismissible: (value: string | null) => void;
			dismiss: () => void;
		};
		panel.setAttribute("message", fixture.input.message);
		row.append(meta, panel);
		section.append(row);
		rows.push({ panel, fixture });
	}
	gallery.append(section);
	for (const { panel, fixture } of rows) {
		panel.setTone(fixture.input.tone);
		panel.setActions(fixture.input.actions.join("\n"));
		panel.setDismissible(fixture.input.dismissible ? "true" : "false");
		if (fixture.input.dismissed) panel.dismiss();
	}
}
