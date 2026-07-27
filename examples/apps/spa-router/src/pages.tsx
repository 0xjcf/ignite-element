import { igniteCore } from "ignite-element/xstate";
import styles from "../styles.css?raw";
import { routerSource } from "./routerStore";

const link = (href: string, label: string, navigate: (to: string) => void) => (
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
	source: routerSource,
	view: ({ snapshot }) => ({
		id: snapshot.context.params.id ?? "",
		path: snapshot.context.path,
		authed: snapshot.context.authed,
	}),
	commands: ({ actor }) => ({
		navigate: (to: string) => actor.send({ type: "NAVIGATE_REQUESTED", to }),
		login: () => actor.send({ type: "LOGIN" }),
		logout: () => actor.send({ type: "LOGOUT" }),
	}),
});

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

registerPage("home-page", (ctx) => (
	<section class="page">
		<h1>Home</h1>
		<p>A tiny single-page app routed entirely by Ignite Element.</p>
		<p>The URL is just state; navigating is just a command.</p>
		<p>{link("/users", "Browse users", ctx.navigate)}</p>
	</section>
));

registerPage("about-page", () => (
	<section class="page">
		<h1>About</h1>
		<p>
			This router models the current route as an XState machine. The machine is
			a pure functional core — matching paths and applying auth guards — while
			the source factory owns browser observation and accepted navigation
			commits.
		</p>
	</section>
));

registerPage("users-page", (ctx) => (
	<section class="page">
		<h1>Users</h1>
		<p>
			Pick a user to see a dynamic <code>/users/:id</code> route.
		</p>
		<ul class="user-list">
			<li>{link("/users/1", "Ada Lovelace", ctx.navigate)}</li>
			<li>{link("/users/2", "Alan Turing", ctx.navigate)}</li>
			<li>{link("/users/3", "Grace Hopper", ctx.navigate)}</li>
		</ul>
	</section>
));

registerPage("user-page", (ctx) => (
	<section class="page">
		<h1>User #{ctx.id}</h1>
		<p>
			This page reads the <code>:id</code> param ({ctx.id}) straight from the
			shared router state.
		</p>
		<p>{link("/users", "← Back to users", ctx.navigate)}</p>
	</section>
));

registerPage("login-page", (ctx) => (
	<section class="page">
		<h1>Log in</h1>
		<p>The dashboard is guarded. Log in to continue.</p>
		<button
			type="button"
			class="primary"
			onClick={() => {
				ctx.login();
				ctx.navigate("/dashboard");
			}}
		>
			Log in &amp; go to dashboard
		</button>
	</section>
));

registerPage("dashboard-page", (ctx) => (
	<section class="page">
		<h1>Dashboard</h1>
		<p>Protected content — only reachable while authenticated.</p>
		<p>Authenticated: {ctx.authed ? "yes" : "no"}</p>
		<button
			type="button"
			onClick={() => {
				ctx.logout();
				ctx.navigate("/");
			}}
		>
			Log out
		</button>
	</section>
));

registerPage("not-found-page", (ctx) => (
	<section class="page">
		<h1>404</h1>
		<p>
			No route matched <code>{ctx.path}</code>.
		</p>
		<p>{link("/", "Go home", ctx.navigate)}</p>
	</section>
));
