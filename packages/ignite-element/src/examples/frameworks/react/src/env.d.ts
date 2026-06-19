// Vite's `?raw` import suffix returns a module's contents as a string. The React
// example uses it to pull `counter.css` in as raw text and inject a `<style>`
// into the element's Shadow DOM via the ignite-JSX view — the config-free
// styling path (no ignite.config.ts, no build plugin). Document CSS can't cross
// the shadow boundary, so component styling lives with the component.
declare module "*.css?raw" {
	const content: string;
	export default content;
}
