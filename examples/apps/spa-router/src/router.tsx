import { igniteCore } from "ignite-element/xstate";
import "./pages";
import styles from "../styles.css?raw";
import { routerSource } from "./routerStore";

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
	source: routerSource,
	states: (snapshot) => ({
		route: snapshot.context.route,
		path: snapshot.context.path,
	}),
	commands: ({ actor }) => ({
		navigate: (to: string) => actor.send({ type: "NAVIGATE_REQUESTED", to }),
	}),
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
