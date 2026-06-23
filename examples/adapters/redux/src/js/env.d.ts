// Vite's `?raw` import suffix returns a module's contents as a string. The redux
// example uses it to pull Bootstrap's stylesheet in as text and inject it into
// each component's Shadow DOM via a <style> tag — the config-free styling path
// (no ignite.config.ts, no build plugin).
declare module "*.css?raw" {
	const content: string;
	export default content;
}
