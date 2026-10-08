// @vitest-environment jsdom

import { within } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { createEmptyStateCore } from "./empty-state.core";
import { emptyStateGallery } from "./empty-state.gallery";
import { emptyStateView } from "./empty-state.view";

const TAG = "empty-state";

function register() {
	if (customElements.get(TAG)) return;
	createEmptyStateCore()(TAG, emptyStateView);
}

function mount(title: string, message: string) {
	register();
	const element = document.createElement(TAG) as HTMLElement & {
		setKind: (kind: string | null) => void;
		setActionLabel: (label: string | null) => void;
	};
	element.setAttribute("title", title);
	element.setAttribute("message", message);
	document.body.appendChild(element);
	const root = element.shadowRoot as unknown as HTMLElement;
	return { element, view: within(root) };
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("EmptyState DOM", () => {
	it("shows each gallery message", () => {
		for (const fixture of emptyStateGallery) {
			document.body.innerHTML = "";
			const { element, view } = mount(
				fixture.input.title,
				fixture.input.message,
			);
			element.setKind(fixture.input.kind);
			element.setActionLabel(fixture.input.actionLabel);
			expect(
				view.getByRole("heading", { name: fixture.input.title }),
			).toBeTruthy();
			expect(view.getByText(fixture.input.message)).toBeTruthy();
			if (fixture.input.actionLabel) {
				expect(
					view.getByRole("button", { name: fixture.input.actionLabel }),
				).toBeTruthy();
			} else {
				expect(view.queryByRole("button")).toBeNull();
			}
		}
	});
});
