// Vite's `?raw` import suffix returns a module's contents as a string. The mobx
// example uses it to inject component styles into Shadow DOM via <style> tags —
// the config-free path (no ignite.config.ts, no build plugin).
declare module "*.css?raw" {
	const content: string;
	export default content;
}
