import { igniteCore } from "ignite-element/xstate";
import styles from "../styles.css?raw";
import { routerSource } from "./routerStore";
import type { DocsSection, ParentRoute, SettingsPanel } from "./routerMachine";

const parentLinks: Array<{ href: string; label: string; route: ParentRoute }> =
	[
		{ href: "/", label: "Home", route: "home" },
		{ href: "/docs", label: "Docs", route: "docs" },
		{ href: "/settings", label: "Settings", route: "settings" },
	];

const docsSections: Array<{ section: DocsSection; label: string }> = [
	{ section: "overview", label: "Overview" },
	{ section: "api", label: "API" },
	{ section: "examples", label: "Examples" },
];

const settingsPanels: Array<{ panel: SettingsPanel; label: string }> = [
	{ panel: "profile", label: "Profile" },
	{ panel: "billing", label: "Billing" },
];

const defineRouteElement = igniteCore({
	source: routerSource,
	view: ({ snapshot }) => ({
		parent: snapshot.context.parent,
		child: snapshot.context.child,
		path: snapshot.context.path,
		label: snapshot.context.label,
	}),
	commands: ({ actor }) => ({
		navigate: (to: string) => actor.send({ type: "NAVIGATE_REQUESTED", to }),
		openDocSection: (section: DocsSection) =>
			actor.send({ type: "OPEN_DOC_SECTION", section }),
		openSettingsPanel: (panel: SettingsPanel) =>
			actor.send({ type: "OPEN_SETTINGS_PANEL", panel }),
	}),
});

export const shouldHandleClientNavigation = (event: MouseEvent): boolean =>
	!event.defaultPrevented &&
	event.button === 0 &&
	!event.metaKey &&
	!event.ctrlKey &&
	!event.shiftKey &&
	!event.altKey;

const parentLink = (
	href: string,
	label: string,
	route: ParentRoute,
	activeRoute: ParentRoute,
	navigate: (to: string) => void,
) => {
	const isActive = route === activeRoute;
	return (
		<a
			href={href}
			class={isActive ? "nav-link is-active" : "nav-link"}
			aria-current={isActive ? "page" : undefined}
			onClick={(event: Event) => {
				if (!shouldHandleClientNavigation(event as MouseEvent)) {
					return;
				}

				event.preventDefault();
				navigate(href);
			}}
		>
			{label}
		</a>
	);
};

const renderOutlet = (parent: ParentRoute) => {
	switch (parent) {
		case "home":
			return <home-panel />;
		case "docs":
			return <docs-child-outlet />;
		case "settings":
			return <settings-child-outlet />;
		default:
			return <not-found-panel />;
	}
};

defineRouteElement("nested-router-app", (ctx) => (
	<div class="app">
		<style>{styles}</style>
		<header class="masthead">
			<span class="eyebrow">Nested child router</span>
			<h1>One route source, composable outlets</h1>
			<p>
				Parent and child outlets project the same shared actor while exposing
				scoped commands for their own navigation surface.
			</p>
		</header>
		<nav class="nav" aria-label="Primary">
			{parentLinks.map((item) =>
				parentLink(item.href, item.label, item.route, ctx.parent, ctx.navigate),
			)}
		</nav>
		<main>{renderOutlet(ctx.parent)}</main>
	</div>
));

defineRouteElement("home-panel", (ctx) => (
	<section class="panel">
		<style>{styles}</style>
		<h2>Home</h2>
		<p>
			The current path is <code>{ctx.path}</code>. Move into Docs or Settings to
			see a child outlet own the second segment.
		</p>
		<button type="button" class="tab" onClick={() => ctx.openDocSection("api")}>
			Jump to API child route
		</button>
	</section>
));

defineRouteElement("docs-child-outlet", (ctx) => (
	<section class="panel child-panel">
		<style>{styles}</style>
		<div>
			<h2>Docs</h2>
			<p class="notice">
				The parent route is <code>docs</code>; this child outlet controls the
				docs section without owning the parent nav.
			</p>
		</div>
		<nav class="tabs" aria-label="Docs sections">
			{docsSections.map((item) => (
				<button
					type="button"
					class={ctx.child === item.section ? "tab is-active" : "tab"}
					aria-current={ctx.child === item.section ? "page" : undefined}
					onClick={() => ctx.openDocSection(item.section)}
				>
					{item.label}
				</button>
			))}
		</nav>
		<ul class="grid">
			<li class="tile">
				<strong>{ctx.label}</strong>
				<span>Projected from the shared router actor.</span>
			</li>
			<li class="tile">
				<strong>{ctx.path}</strong>
				<span>Canonical nested path.</span>
			</li>
		</ul>
	</section>
));

defineRouteElement("settings-child-outlet", (ctx) => (
	<section class="panel child-panel">
		<style>{styles}</style>
		<div>
			<h2>Settings</h2>
			<p class="notice">
				Settings has its own child tab contract while still projecting the same
				parent route source.
			</p>
		</div>
		<nav class="tabs" aria-label="Settings panels">
			{settingsPanels.map((item) => (
				<button
					type="button"
					class={ctx.child === item.panel ? "tab is-active" : "tab"}
					aria-current={ctx.child === item.panel ? "page" : undefined}
					onClick={() => ctx.openSettingsPanel(item.panel)}
				>
					{item.label}
				</button>
			))}
		</nav>
		<div class="tile">
			<strong>{ctx.label}</strong>
			<span>
				The child route is <code>{ctx.child}</code> at <code>{ctx.path}</code>.
			</span>
		</div>
	</section>
));

defineRouteElement("not-found-panel", (ctx) => (
	<section class="panel">
		<style>{styles}</style>
		<h2>Route not found</h2>
		<p>
			No parent or child route matched <code>{ctx.path}</code>.
		</p>
		<button type="button" class="tab" onClick={() => ctx.navigate("/")}>
			Go home
		</button>
	</section>
));
