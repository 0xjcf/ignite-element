/** @jsxImportSource ignite-element/jsx */
import type { IgniteJsxElement } from "ignite-element/jsx";
import { catalogHostStyles } from "../styles";
import type { AppShellCommands, AppShellStates } from "./app-shell.core";

export type AppShellViewContext = AppShellStates & AppShellCommands;

const styles = `${catalogHostStyles()}
:host { display: block; }
.shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-height: 12rem;
  background: var(--catalog-bg);
  color: var(--catalog-fg);
}
.skip {
  position: absolute;
  left: 0.5rem;
  top: 0.5rem;
  padding: 0.4rem 0.7rem;
  background: var(--catalog-fg);
  color: var(--catalog-surface);
  transform: translateY(-150%);
}
.skip:focus { transform: none; z-index: 1; }
.bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--catalog-line);
  background: var(--catalog-surface);
}
.bar button, .skip {
  min-height: 44px;
  box-sizing: border-box;
  border: 1px solid var(--catalog-fg);
  border-radius: 6px;
  background: var(--catalog-surface);
  color: var(--catalog-fg);
  font: 600 0.95rem/1.2 var(--catalog-font);
}
.route { margin: 0; font-weight: 650; }
.nav, .panel {
  padding: 0.75rem 1rem;
  background: var(--catalog-surface);
  border-bottom: 1px solid var(--catalog-line);
}
.main { padding: 1rem; }
.main:focus { outline: 2px solid var(--catalog-fg); outline-offset: 2px; }
@media (min-width: 768px) {
  .shell[data-panel="open"] {
    grid-template-columns: minmax(0, 1fr) 16rem;
  }
  .shell[data-menu="open"] {
    grid-template-columns: 14rem minmax(0, 1fr);
  }
  .shell[data-menu="open"][data-panel="open"] {
    grid-template-columns: 14rem minmax(0, 1fr) 16rem;
  }
  .bar { grid-column: 1 / -1; }
  .nav { border-right: 1px solid var(--catalog-line); border-bottom: 0; }
  .panel { border-left: 1px solid var(--catalog-line); border-bottom: 0; }
}
`;

function focusMain(event: Event) {
	event.preventDefault();
	const root = (event.currentTarget as HTMLElement).getRootNode();
	if (!(root instanceof ShadowRoot)) return;
	const main = root.querySelector("main");
	if (main instanceof HTMLElement) main.focus();
}

/**
 * Frame and slots only. The app owns what goes in nav, main, and the side panel.
 * This view does not import Tabs.
 */
export function appShellView(ctx: AppShellViewContext): IgniteJsxElement {
	return (
		<>
			<style>{styles}</style>
			<div
				class="shell"
				data-menu={ctx.isMenuOpen ? "open" : "closed"}
				data-panel={ctx.showPanel ? "open" : "closed"}
				onKeydown={(event: KeyboardEvent) => {
					if (event.key === "Escape" && ctx.isMenuOpen) ctx.closeMenu();
				}}
			>
				{/* Skip links are anchors so the browser can move to #main. */}
				{/* biome-ignore lint/a11y/useValidAnchor: in-page skip link */}
				<a class="skip" href="#main" onClick={focusMain}>
					Skip to main content
				</a>
				<div class="bar">
					<button
						type="button"
						aria-expanded={ctx.isMenuOpen ? "true" : "false"}
						aria-controls="nav"
						onClick={() => {
							if (ctx.isMenuOpen) ctx.closeMenu();
							else ctx.openMenu();
						}}
					>
						{ctx.isMenuOpen ? "Close menu" : "Menu"}
					</button>
					{ctx.showReturn ? (
						<button
							type="button"
							onClick={() => {
								if (ctx.canReturn) ctx.requestReturn();
							}}
							aria-disabled={ctx.canReturn ? "false" : "true"}
						>
							Back to {ctx.returnTo}
						</button>
					) : null}
					<p class="route">{ctx.activeRoute}</p>
				</div>
				<nav
					id="nav"
					class="nav"
					aria-label="Primary"
					hidden={ctx.showMenu ? undefined : true}
				>
					<slot name="nav"></slot>
				</nav>
				<main id="main" class="main" tabindex="-1">
					<slot name="main"></slot>
				</main>
				<aside
					class="panel"
					aria-label="Side panel"
					hidden={ctx.showPanel ? undefined : true}
				>
					<slot name="panel"></slot>
				</aside>
			</div>
		</>
	);
}
