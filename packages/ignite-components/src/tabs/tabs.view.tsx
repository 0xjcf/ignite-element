/** @jsxImportSource ignite-element/jsx */
import { type IgniteJsxElement, jsx } from "ignite-element/jsx";
import { catalogHostStyles } from "../styles";
import type { TabsCommands, TabsStates } from "./tabs.core";

export type TabsViewContext = TabsStates & TabsCommands;

const styles = `${catalogHostStyles()}
:host { display: block; max-width: 40rem; }
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
button {
  min-height: 44px;
  box-sizing: border-box;
  padding: 0.45rem 0.9rem;
  border: 1px solid var(--catalog-fg);
  border-radius: 999px;
  background: var(--catalog-surface);
  color: var(--catalog-fg);
  font: 600 0.95rem/1.2 var(--catalog-font);
}
button[aria-selected="true"] {
  background: var(--catalog-fg);
  color: var(--catalog-surface);
}
button:focus { outline: 2px solid var(--catalog-fg); outline-offset: 2px; }
.empty {
  margin: 0;
  color: var(--catalog-fg);
  font: 400 1rem/1.4 var(--catalog-font);
}
`;

function tabsHost(items: readonly string[]): string {
	let hash = 2166136261;
	for (const item of items) {
		for (let index = 0; index < item.length; index++) {
			hash ^= item.charCodeAt(index);
			hash = Math.imul(hash, 16777619);
		}
		hash ^= 0x1f;
		hash = Math.imul(hash, 16777619);
	}
	return `x-tabs-${(hash >>> 0).toString(36)}`;
}

function move(
	items: readonly string[],
	active: string | null,
	step: number,
): string {
	if (items.length === 0) return "";
	const index = active === null ? 0 : items.indexOf(active);
	const start = index < 0 ? 0 : index;
	const next = (start + step + items.length) % items.length;
	return items[next] ?? items[0] ?? "";
}

function tabList(ctx: TabsViewContext): IgniteJsxElement {
	return jsx(tabsHost(ctx.items), {
		class: "tabs",
		role: "tablist",
		"aria-label": ctx.label,
		onkeydown: (event: Event) => {
			if (!(event instanceof KeyboardEvent)) return;
			const key = event.key;
			if (
				key !== "ArrowRight" &&
				key !== "ArrowLeft" &&
				key !== "Home" &&
				key !== "End"
			) {
				return;
			}
			event.preventDefault();
			const id =
				key === "Home"
					? ctx.items[0]
					: key === "End"
						? ctx.items[ctx.items.length - 1]
						: move(ctx.items, ctx.active, key === "ArrowRight" ? 1 : -1);
			if (!id) return;
			ctx.select(id);
			const list = event.currentTarget;
			if (!(list instanceof HTMLElement)) return;
			const next = [...list.querySelectorAll("[role='tab']")].find(
				(tab) => tab.textContent === id,
			);
			if (next instanceof HTMLElement) next.focus();
		},
		children: ctx.items.map((item) => {
			const selected = item === ctx.active;
			return jsx("button", {
				type: "button",
				role: "tab",
				"aria-selected": selected ? "true" : "false",
				tabindex:
					selected || (ctx.active === null && item === ctx.items[0])
						? "0"
						: "-1",
				onClick: () => {
					if (ctx.canSelect) ctx.select(item);
				},
				children: [item],
			});
		}),
	});
}

/**
 * The selected name is the view. Color only marks which tab is active.
 * Panel content stays with the host.
 */
export function tabsView(ctx: TabsViewContext): IgniteJsxElement {
	return (
		<>
			<style>{styles}</style>
			{ctx.showTabs ? tabList(ctx) : <p class="empty">There are no tabs.</p>}
		</>
	);
}
