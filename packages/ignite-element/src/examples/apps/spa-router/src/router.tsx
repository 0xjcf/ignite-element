import { igniteCore } from "ignite-element/xstate";
import { pushPath } from "./history";
import "./pages";
// Ignite renders into Shadow DOM, so the global sheet linked in index.html
// can't reach component internals. Pull it in as raw text and inject a <style>
// into the shadow root — the config-free styling path (no ignite.config.ts).
import styles from "../styles.css?raw";
import { routerActor } from "./routerStore";

// The outlet element: it renders the nav and swaps in whichever page element
// matches the active route. It also owns the single History *write*: an effect
// that pushes a new URL when — and only when — a `navigate` command moved us.
// POPSTATE-driven changes are skipped (the browser already changed the URL),
// which keeps back/forward from stacking duplicate history entries.

const NAV = [
	{ href: "/", label: "Home" },
	{ href: "/about", label: "About" },
	{ href: "/users", label: "Users" },
	{ href: "/dashboard", label: "Dashboard" },
] as const;

const navLink = (
	href: string,
	label: string,
	activePath: string,
	navigate: (to: string) => void,
) => {
	const isActive =
		href === "/" ? activePath === "/" : activePath.startsWith(href);
	return (
		<a
			href={href}
			class={isActive ? "nav-link is-active" : "nav-link"}
			aria-current={isActive ? "page" : undefined}
			onClick={(event: Event) => {
				event.preventDefault();
				navigate(href);
			}}
		>
			{label}
		</a>
	);
};

const renderPage = (route: string) => {
	switch (route) {
		case "home":
			return <home-page />;
		case "about":
			return <about-page />;
		case "users":
			return <users-page />;
		case "user":
			return <user-page />;
		case "login":
			return <login-page />;
		case "dashboard":
			return <dashboard-page />;
		default:
			return <not-found-page />;
	}
};

const registerRouter = igniteCore({
	source: routerActor,
	view: ({ snapshot }) => ({
		route: snapshot.context.route,
		path: snapshot.context.path,
	}),
	commands: ({ actor }) => ({
		navigate: (to: string) => actor.send({ type: "NAVIGATE", to }),
	}),
	// Consequence of a navigate intent: write the URL. Skipping `popstate` and
	// `init` keeps the History core/shell boundary clean and avoids double entries.
	effects: ({ snapshot, prevSnapshot }) => {
		if (
			snapshot.context.source === "navigate" &&
			snapshot.context.path !== prevSnapshot.context.path
		) {
			pushPath(snapshot.context.path);
		}
	},
	// The shared `routerActor` is owned by routerStore (app lifetime), not by any
	// one element. Passing it as a live source keeps the shared adapter alive for
	// the core's lifetime by default, so the outlet's disconnect won't tear it
	// down. See pages.tsx.
});

registerRouter("app-router", (ctx) => (
	<div class="app">
		<style>{styles}</style>
		<nav class="nav" aria-label="Primary">
			{NAV.map((item) =>
				navLink(item.href, item.label, ctx.path, ctx.navigate),
			)}
		</nav>
		<main class="content">{renderPage(ctx.route)}</main>
	</div>
));
