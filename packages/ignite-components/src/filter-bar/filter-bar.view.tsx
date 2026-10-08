/** @jsxImportSource ignite-element/jsx */
import { type IgniteJsxElement, jsx } from "ignite-element/jsx";
import { catalogHostStyles } from "../styles";
import type { FilterBarCommands, FilterBarStates } from "./filter-bar.core";

export type FilterBarViewContext = FilterBarStates & FilterBarCommands;

const styles = `${catalogHostStyles()}
:host { display: block; max-width: 40rem; }
.bar { display: grid; gap: 0.6rem; }
.label {
  font: 650 0.95rem/1.3 var(--catalog-font);
  color: var(--catalog-fg);
}
.control {
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--catalog-fg);
  border-radius: 6px;
  background: var(--catalog-surface);
  color: var(--catalog-fg);
  font: 400 1rem/1.4 var(--catalog-font);
}
.control:focus { outline: 2px solid var(--catalog-fg); outline-offset: 2px; }
.filters { display: flex; flex-wrap: wrap; gap: 0.4rem; }
button {
  min-height: 44px;
  box-sizing: border-box;
  padding: 0.45rem 0.85rem;
  border: 1px solid var(--catalog-fg);
  border-radius: 999px;
  background: var(--catalog-surface);
  color: var(--catalog-fg);
  font: 600 0.95rem/1.2 var(--catalog-font);
}
button[aria-pressed="true"] {
  background: var(--catalog-fg);
  color: var(--catalog-surface);
}
button.clear {
  border-radius: 6px;
  background: var(--catalog-fg);
  color: var(--catalog-surface);
}
button:focus { outline: 2px solid var(--catalog-fg); outline-offset: 2px; }
`;

function chipsHost(filters: readonly string[]): string {
	let hash = 2166136261;
	for (const filter of filters) {
		for (let index = 0; index < filter.length; index++) {
			hash ^= filter.charCodeAt(index);
			hash = Math.imul(hash, 16777619);
		}
		hash ^= 0x1f;
		hash = Math.imul(hash, 16777619);
	}
	return `x-filters-${(hash >>> 0).toString(36)}`;
}

function readValue(event: Event): string | null {
	const target = event.target;
	if (target instanceof HTMLInputElement) return target.value;
	return null;
}

function chips(ctx: FilterBarViewContext): IgniteJsxElement {
	return jsx(chipsHost(ctx.filters), {
		class: "filters",
		children: ctx.filters.map((name) => {
			const pressed = ctx.active.includes(name);
			return jsx("button", {
				type: "button",
				"aria-pressed": pressed ? "true" : "false",
				onClick: () => {
					ctx.toggle(name);
				},
				children: [name],
			});
		}),
	});
}

/**
 * The words name the filter. The host decides which rows remain.
 * Clear filters is visible only while something is narrowed.
 */
export function filterBarView(ctx: FilterBarViewContext): IgniteJsxElement {
	return (
		<>
			<style>{styles}</style>
			<div class="bar">
				<label class="label" for="filter-query">
					{ctx.label}
				</label>
				<input
					id="filter-query"
					class="control"
					type="search"
					value={ctx.query}
					onInput={(event: Event) => {
						const value = readValue(event);
						if (value !== null) ctx.setQuery(value);
					}}
				/>
				{ctx.showFilters ? chips(ctx) : null}
				{ctx.canClear ? (
					<button
						type="button"
						class="clear"
						onClick={() => {
							ctx.clear();
						}}
					>
						Clear filters
					</button>
				) : null}
			</div>
		</>
	);
}
