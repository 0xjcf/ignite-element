import { createFieldCore } from "../src/field/field.core";
import { fieldGallery } from "../src/field/field.gallery";
import { fieldView } from "../src/field/field.view";

const TAG = "catalog-field";
createFieldCore()(TAG, fieldView);

const gallery = document.querySelector("#gallery");
if (!gallery) throw new Error("missing gallery");

const apps = ["Twilight", "Booster Budget"] as const;

for (const app of apps) {
	const fixtures = fieldGallery.filter((fixture) => fixture.app === app);
	const section = document.createElement("section");
	const heading = document.createElement("h2");
	heading.textContent = app;
	section.append(heading);
	const rows: Array<{
		field: HTMLElement & {
			setValue: (value: string | null) => void;
			setHint: (hint: string | null) => void;
			setError: (error: string | null) => void;
			setRequired: (required: string | null) => void;
			setMultiline: (multiline: string | null) => void;
			touch: () => void;
		};
		fixture: (typeof fixtures)[number];
	}> = [];
	for (const fixture of fixtures) {
		const row = document.createElement("div");
		row.className = "fixture";
		const meta = document.createElement("p");
		meta.className = "meta";
		meta.textContent = fixture.title;
		const field = document.createElement(TAG) as HTMLElement & {
			setValue: (value: string | null) => void;
			setHint: (hint: string | null) => void;
			setError: (error: string | null) => void;
			setRequired: (required: string | null) => void;
			setMultiline: (multiline: string | null) => void;
			touch: () => void;
		};
		field.setAttribute("label", fixture.input.label);
		row.append(meta, field);
		section.append(row);
		rows.push({ field, fixture });
	}
	gallery.append(section);
	for (const { field, fixture } of rows) {
		field.setMultiline(fixture.input.multiline ? "true" : "false");
		field.setRequired(fixture.input.required ? "true" : "false");
		field.setValue(fixture.input.value);
		field.setHint(fixture.input.hint);
		field.setError(fixture.input.error);
		if (fixture.input.touched) field.touch();
	}
}
