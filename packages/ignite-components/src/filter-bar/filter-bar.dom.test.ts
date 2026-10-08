// @vitest-environment jsdom

import { within } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { createFilterBarCore } from "./filter-bar.core";
import { filterBarGallery } from "./filter-bar.gallery";
import { filterBarView } from "./filter-bar.view";

const TAG = "catalog-filter-bar";

function register() {
	if (customElements.get(TAG)) return;
	createFilterBarCore()(TAG, filterBarView);
}

function mount(label: string) {
	register();
	const element = document.createElement(TAG) as HTMLElement & {
		setQuery: (query: string | null) => void;
		setFilters: (filters: string | null) => void;
		setActive: (active: string | null) => void;
		toggle: (id: string | null) => void;
		clear: () => void;
	};
	element.setAttribute("label", label);
	document.body.appendChild(element);
	const root = element.shadowRoot as unknown as HTMLElement;
	return { element, root, view: within(root) };
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("FilterBar DOM", () => {
	it("shows each gallery query, chip, and clear control", () => {
		for (const fixture of filterBarGallery) {
			document.body.innerHTML = "";
			const { element, view } = mount(fixture.input.label);
			element.setFilters(fixture.input.filters);
			element.setQuery(fixture.input.query);
			element.setActive(fixture.input.active);
			const box = view.getByRole("searchbox", { name: fixture.input.label });
			expect((box as HTMLInputElement).value).toBe(fixture.input.query);
			for (const name of fixture.input.filters.split("\n").filter(Boolean)) {
				const pressed = fixture.input.active.split("\n").includes(name);
				expect(
					view.getByRole("button", { name }).getAttribute("aria-pressed"),
				).toBe(pressed ? "true" : "false");
			}
			if (fixture.state === "filtered") {
				expect(
					view.getByRole("button", { name: "Clear filters" }),
				).toBeTruthy();
			} else {
				expect(
					view.queryByRole("button", { name: "Clear filters" }),
				).toBeNull();
			}
		}
	});

	it("emits change while narrowing and clear when the criteria go away", () => {
		const { element, view } = mount("Filter the event log");
		element.setFilters("Type\nSurface");
		const changes: string[] = [];
		const clears: number[] = [];
		element.addEventListener("change", (event) => {
			const detail = (event as CustomEvent<{ query: string; active: string[] }>)
				.detail;
			changes.push(`${detail.query}:${detail.active.join(",")}`);
		});
		element.addEventListener("clear", () => {
			clears.push(1);
		});
		view.getByRole("button", { name: "Type" }).click();
		const box = view.getByRole("searchbox") as HTMLInputElement;
		box.value = "connect";
		box.dispatchEvent(new Event("input", { bubbles: true }));
		view.getByRole("button", { name: "Clear filters" }).click();
		expect(changes).toEqual([":Type", "connect:Type"]);
		expect(clears).toEqual([1]);
		expect(view.queryByRole("button", { name: "Clear filters" })).toBeNull();
		expect((view.getByRole("searchbox") as HTMLInputElement).value).toBe("");
	});
});
