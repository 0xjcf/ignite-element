import { defineIgniteConfig } from "ignite-renderer";

export default defineIgniteConfig({
	// Resolve to an absolute URL so Vite dev/preview and static builds
	// all load the stylesheet correctly.
	styles: new URL("./dist/styles.css", import.meta.url).href,
});
