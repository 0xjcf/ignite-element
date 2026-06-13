// Vite's `?raw` import suffix returns a module's contents as a string. The
// xstate example uses it to pull the built Tailwind sheet (`dist/styles.css`,
// produced by `build:css`) in as text and inject it into each component's
// Shadow DOM via a <style> tag — the config-free styling path (no
// ignite.config.ts, no build plugin). `dev`/`build` run `build:css` first.
declare module "*.css?raw" {
	const content: string;
	export default content;
}
