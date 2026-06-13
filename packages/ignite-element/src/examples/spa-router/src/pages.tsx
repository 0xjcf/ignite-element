import { igniteCore } from "ignite-element/xstate";
import { login, logout, navigate, routerActor } from "./routerStore";
// Each page is its own Shadow DOM, so it needs its own copy of the shared
// styles. Pull the sheet in as raw text (config-free) and inject it once per
// page via the `registerPage` wrapper below — no ignite.config.ts, no plugin.
import styles from "../styles.css?raw";

// Each page is its own custom element registered against the SAME shared router
// actor, so every page projects the same live route state (params, auth) — no
// prop drilling, no attribute plumbing. Composition happens through HTML: the
// outlet renders whichever page tag matches the active route.

// In-page navigation link: a real <a> for accessibility and middle-click, with
// a click handler that hands control to the client router instead of the browser.
const link = (href: string, label: string) => (
	<a
		href={href}
		class="link"
		onClick={(event: Event) => {
			event.preventDefault();
			navigate(href);
		}}
	>
		{label}
	</a>
);

const definePage = igniteCore({
	source: routerActor,
	view: ({ context }) => ({
		id: context.params.id ?? "",
		path: context.path,
		authed: context.authed,
	}),
	commands: () => ({ navigate, login, logout }),
	// `routerActor` is an app-lifetime singleton owned by routerStore, shared by
	// every page element. Default `cleanup: true` stops the shared adapter when
	// the last instance of ANY one page element disconnects — and because the
	// outlet swaps pages (unmounting the outgoing one), that would freeze the
	// shared adapter for the incoming page (stale params/route). `cleanup: false`
	// keeps it live; the shell (routerStore) owns the actor's lifetime instead.
	cleanup: false,
});

// Register a page element, injecting the shared <style> into its shadow root
// alongside the page's own markup. Keeps the per-page styling boilerplate in
// one place instead of repeating a <style> tag in every template.
// The render param is a union (function | object | class renderer); pull out
// just the function form so the wrapper can call it.
type PageRender = Extract<
	Parameters<typeof definePage>[1],
	(args: never) => unknown
>;
const registerPage = (name: string, render: PageRender) =>
	definePage(name, (args) => (
		<>
			<style>{styles}</style>
			{render(args)}
		</>
	));

registerPage("home-page", () => (
	<section class="page">
		<h1>Home</h1>
		<p>A tiny single-page app routed entirely by Ignite Element.</p>
		<p>The URL is just state; navigating is just a command.</p>
		<p>{link("/users", "Browse users")}</p>
	</section>
));

registerPage("about-page", () => (
	<section class="page">
		<h1>About</h1>
		<p>
			This router models the current route as an XState machine. The machine is
			a pure functional core — matching paths and applying auth guards — while
			History reads/writes live in the shell.
		</p>
	</section>
));

registerPage("users-page", () => (
	<section class="page">
		<h1>Users</h1>
		<p>
			Pick a user to see a dynamic <code>/users/:id</code> route.
		</p>
		<ul class="user-list">
			<li>{link("/users/1", "Ada Lovelace")}</li>
			<li>{link("/users/2", "Alan Turing")}</li>
			<li>{link("/users/3", "Grace Hopper")}</li>
		</ul>
	</section>
));

registerPage("user-page", ({ id }) => (
	<section class="page">
		<h1>User #{id}</h1>
		<p>
			This page reads the <code>:id</code> param ({id}) straight from the shared
			router state.
		</p>
		<p>{link("/users", "← Back to users")}</p>
	</section>
));

registerPage("login-page", ({ navigate, login }) => (
	<section class="page">
		<h1>Log in</h1>
		<p>The dashboard is guarded. Log in to continue.</p>
		<button
			type="button"
			class="primary"
			onClick={() => {
				login();
				navigate("/dashboard");
			}}
		>
			Log in &amp; go to dashboard
		</button>
	</section>
));

registerPage("dashboard-page", ({ authed, logout, navigate }) => (
	<section class="page">
		<h1>Dashboard</h1>
		<p>Protected content — only reachable while authenticated.</p>
		<p>Authenticated: {authed ? "yes" : "no"}</p>
		<button
			type="button"
			onClick={() => {
				logout();
				navigate("/");
			}}
		>
			Log out
		</button>
	</section>
));

registerPage("not-found-page", ({ path }) => (
	<section class="page">
		<h1>404</h1>
		<p>
			No route matched <code>{path}</code>.
		</p>
		<p>{link("/", "Go home")}</p>
	</section>
));
