import { createAppShellCore } from "../src/app-shell/app-shell.core";
import { appShellGallery } from "../src/app-shell/app-shell.gallery";
import { appShellView } from "../src/app-shell/app-shell.view";

const TAG = "app-shell";
createAppShellCore()(TAG, appShellView);

const gallery = document.querySelector("#gallery");
if (!gallery) throw new Error("missing gallery");

const apps = ["Catalog", "DevTools", "Twilight", "Booster Budget"] as const;

const navLabels: Record<string, readonly string[]> = {
	DevTools: ["Inspector", "Log"],
	Twilight: ["Today", "Capture"],
	"Booster Budget": ["Home", "Calendar"],
	Catalog: ["Overview"],
};

for (const app of apps) {
	const fixtures = appShellGallery.filter((fixture) =>
		app === "Catalog" ? !fixture.app : fixture.app === app,
	);
	if (fixtures.length === 0) continue;
	const section = document.createElement("section");
	const heading = document.createElement("h2");
	heading.textContent = app;
	section.append(heading);
	const shells: Array<{
		shell: HTMLElement & {
			setReturnTo: (value: string | null) => void;
			setPanel: (open: string | null) => void;
			openMenu: () => void;
		};
		fixture: (typeof fixtures)[number];
	}> = [];
	for (const fixture of fixtures) {
		const row = document.createElement("div");
		row.className = "fixture";
		const meta = document.createElement("p");
		meta.className = "meta";
		meta.textContent = fixture.title;
		const shell = document.createElement(TAG) as HTMLElement & {
			setReturnTo: (value: string | null) => void;
			setPanel: (open: string | null) => void;
			openMenu: () => void;
		};
		shell.setAttribute("route", fixture.input.activeRoute);
		const labels = navLabels[fixture.app ?? "Catalog"] ?? ["Overview"];
		for (const label of labels) {
			const link = document.createElement("a");
			link.slot = "nav";
			link.href = "#main";
			link.textContent = label;
			shell.append(link);
		}
		const page = document.createElement("p");
		page.slot = "main";
		page.textContent =
			fixture.app === "Twilight"
				? "Capacity 0/3. The frame does not pick the next route."
				: fixture.app === "Booster Budget"
					? "This week stays in the app. The shell only frames it."
					: "Runtime states for the selected route.";
		const panel = document.createElement("p");
		panel.slot = "panel";
		panel.textContent = "Detail stays in this slot.";
		shell.append(page, panel);
		row.append(meta, shell);
		section.append(row);
		shells.push({ shell, fixture });
	}
	gallery.append(section);
	for (const { shell, fixture } of shells) {
		shell.setReturnTo(fixture.input.returnTo);
		shell.setPanel(fixture.input.panelOpen ? "true" : "false");
		if (fixture.input.menuOpen) shell.openMenu();
	}
}
